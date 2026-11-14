#!/usr/bin/env bash
# 水獭家族 macOS App 共用：对 .app / .dmg 做 Developer ID 签名 + Apple 公证 + stapler。
# 在 App 根目录执行 ./tool/otter notarize（package.sh --notarize 也会调用）。
#
# 用法：
#   ./tool/otter notarize /path/to/<App>.app
#   ./tool/otter notarize /path/to/<App>.dmg
#   ./tool/otter notarize --sign-only /path/to/<App>.app
#
# 环境变量（可选）：
#   SIGN_IDENTITY   默认 Developer ID Application: ShaoXiao Zhao (N7VA78G2EU)
#   NOTARY_PROFILE  默认 ottergit-notary（notarytool store-credentials 的 profile）
#   ENTITLEMENTS    默认 macos/Runner/Release.entitlements
#
# 首次配置公证账号：
#   xcrun notarytool store-credentials "ottergit-notary" \
#     --apple-id "你的邮箱" --team-id "N7VA78G2EU" --password "app-specific-password"

set -euo pipefail

ROOT="$PWD"
HERE="$(cd "$(dirname "$0")" && pwd)"

SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: ShaoXiao Zhao (N7VA78G2EU)}"
NOTARY_PROFILE="${NOTARY_PROFILE:-ottergit-notary}"
ENTITLEMENTS="${ENTITLEMENTS:-$ROOT/macos/Runner/Release.entitlements}"

SIGN_ONLY=0
TARGET=""

usage() {
  sed -n '2,18p' "$0"
}

for arg in "$@"; do
  case "$arg" in
    --sign-only) SIGN_ONLY=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "未知参数: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -n "$TARGET" ]]; then
        echo "只能指定一个目标路径" >&2
        exit 1
      fi
      TARGET="$arg"
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -e "$TARGET" ]]; then
  echo "不存在: $TARGET" >&2
  exit 1
fi

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令: $1" >&2
    exit 1
  }
}

need codesign
need xcrun
need ditto

# 本地 HTTP 代理（如 127.0.0.1:789x）常导致 notarytool connectTimeout。
# 但反过来直连也可能被掐（实测 2026-10-29 上午直连通、下午 S3 上传直连必超时），
# 所以留了 NOTARY_KEEP_PROXY=1 开关：直连报 deadlineExceeded 时用它走代理重试。
clear_proxy_for_notary() {
  if [[ "${NOTARY_KEEP_PROXY:-0}" == "1" ]]; then
    echo "==> NOTARY_KEEP_PROXY=1，保留代理设置提交公证"
    return
  fi
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy || true
}

# codesign 的时间戳请求走 CFNetwork，认的是**系统代理**（scutil --proxy），不吃
# HTTP_PROXY 环境变量。本机系统代理会把 Apple TSA 掐掉，报
# "The timestamp service is not available"；而 curl 直连是通的。
# 解法：127.0.0.1 在代理例外列表里，所以让 codesign 打本地中继
# （水獭家族仓 tool/app/tsa_relay.py），由中继直连 Apple TSA 代取时间戳。
#   python3 "$HERE/tsa_relay.py" 8899 &
#   CODESIGN_TIMESTAMP_URL=http://127.0.0.1:8899/ts01 ./tool/otter release
if [[ -n "${CODESIGN_TIMESTAMP_URL:-}" ]]; then
  TS_FLAG="--timestamp=${CODESIGN_TIMESTAMP_URL}"
  echo "==> 时间戳走中继: ${CODESIGN_TIMESTAMP_URL}"
else
  TS_FLAG="--timestamp"
fi

# 由内向外签名 .app（避免 --deep 把 entitlements 套到 framework 上）。
sign_app() {
  local app="$1"
  if [[ ! -d "$app" || "${app##*.}" != "app" ]]; then
    echo "不是 .app 包: $app" >&2
    exit 1
  fi
  if [[ ! -f "$ENTITLEMENTS" ]]; then
    echo "找不到 entitlements: $ENTITLEMENTS" >&2
    exit 1
  fi

  echo "==> 清除隔离属性"
  xattr -cr "$app" 2>/dev/null || true

  # 勿把 $VAR 紧贴中文括号，部分 bash + set -u 会把后缀字节算进变量名。
  echo "==> 签名嵌套二进制 / framework: $SIGN_IDENTITY"
  # 先签 dylib / so，再签 .framework 包，最后签 helper .app，最后主包。
  local f
  while IFS= read -r -d '' f; do
    codesign --force --options runtime "$TS_FLAG" --sign "$SIGN_IDENTITY" "$f"
  done < <(find "$app/Contents" \( -name '*.dylib' -o -name '*.so' \) -type f -print0 2>/dev/null)

  # 深层 framework 先签（路径更长优先）
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    codesign --force --options runtime "$TS_FLAG" --sign "$SIGN_IDENTITY" "$f"
  done < <(find "$app/Contents" -name '*.framework' -type d 2>/dev/null | awk '{ print length, $0 }' | sort -rn | cut -d' ' -f2-)

  while IFS= read -r -d '' f; do
    # 跳过主包自身
    [[ "$f" == "$app" ]] && continue
    codesign --force --options runtime "$TS_FLAG" --sign "$SIGN_IDENTITY" "$f"
  done < <(find "$app/Contents" -name '*.app' -type d -print0 2>/dev/null)

  # 主可执行文件（若未被 framework 覆盖）
  local bin
  bin="$(find "$app/Contents/MacOS" -type f -perm +111 2>/dev/null | head -1 || true)"
  if [[ -n "$bin" ]]; then
    codesign --force --options runtime "$TS_FLAG" --sign "$SIGN_IDENTITY" "$bin"
  fi

  echo "==> 签名主应用 (hardened runtime + entitlements)"
  codesign --force --options runtime "$TS_FLAG" \
    --entitlements "$ENTITLEMENTS" \
    --sign "$SIGN_IDENTITY" \
    "$app"

  echo "==> 校验签名"
  codesign --verify --deep --strict --verbose=2 "$app"
  echo "==> 签名 OK: $app"
}

# 三个阶段的网络需求互相打架，这是本机唯一的坑：
#   codesign 取时间戳 → 走系统代理必失败（Clash 掐 Apple TSA），要走本地中继；
#   notarytool 上传    → 直连 S3 必超时（deadlineExceeded），要走代理；
#   stapler 取票据     → 走系统代理必失败（api.apple-cloudkit.com TLS -1200），
#                        直连正常，而 stapler 没有代理参数。
# 所以只有 stapler 前后做一次「临时关系统代理 → 取票 → 立刻还原」。
# 关掉的网络服务名默认 Wi-Fi，可用 NET_SERVICE 覆盖。
NET_SERVICE="${NET_SERVICE:-Wi-Fi}"

_px_state() {
  networksetup -get"$1" "$NET_SERVICE" 2>/dev/null |
    awk -F': ' '/^Enabled/ {print $2; exit}'
}

_px_off_all() {
  _PX_WEB="$(_px_state webproxy)"
  _PX_SEC="$(_px_state securewebproxy)"
  _PX_SOCK="$(_px_state socksfirewallproxy)"
  networksetup -setwebproxystate "$NET_SERVICE" off 2>/dev/null || true
  networksetup -setsecurewebproxystate "$NET_SERVICE" off 2>/dev/null || true
  networksetup -setsocksfirewallproxystate "$NET_SERVICE" off 2>/dev/null || true
}

_px_restore() {
  [[ "${_PX_WEB:-No}" == "Yes" ]] &&
    networksetup -setwebproxystate "$NET_SERVICE" on 2>/dev/null || true
  [[ "${_PX_SEC:-No}" == "Yes" ]] &&
    networksetup -setsecurewebproxystate "$NET_SERVICE" on 2>/dev/null || true
  [[ "${_PX_SOCK:-No}" == "Yes" ]] &&
    networksetup -setsocksfirewallproxystate "$NET_SERVICE" on 2>/dev/null || true
}

# stapler 抓票据走 CFNetwork，只认系统代理；本机代理对它必挂。
# 关代理是整个脚本里唯一有副作用的动作，所以：取票失败也要还原，并重试两轮。
# 要严格失败请设 STRICT_STAPLE=1；设 STAPLE_NO_PROXY_TOGGLE=1 可跳过切换（CI 里没用）。
staple_best_effort() {
  local target="$1"
  local i ok=0

  for i in 1 2; do
    if [[ "${STAPLE_NO_PROXY_TOGGLE:-0}" != "1" ]]; then
      _px_off_all
    fi
    if xcrun stapler staple "$target" && xcrun stapler validate "$target"; then
      ok=1
    fi
    _px_restore
    [[ "$ok" -eq 1 ]] && return 0
    echo "   stapler 第 ${i} 次失败，重试..." >&2
    sleep 2
  done

  if [[ "${STRICT_STAPLE:-0}" == "1" ]]; then
    echo "stapler 失败（STRICT_STAPLE=1）" >&2
    exit 1
  fi
  echo "   ⚠️ 未能附上离线票据：首次启动需联网校验一次，其余功能不受影响" >&2
  return 0
}

notarize_and_staple_app() {
  local app="$1"
  local tmp_zip
  tmp_zip="${TMPDIR:-/tmp}/ottergit-notarize-$$.zip"
  rm -f "$tmp_zip"

  echo "==> 打包临时 ZIP 供公证: $tmp_zip"
  ditto -c -k --keepParent "$app" "$tmp_zip"

  clear_proxy_for_notary
  echo "==> 提交公证, profile=$NOTARY_PROFILE ..."
  notary_submit_wait "$tmp_zip"

  rm -f "$tmp_zip"

  echo "==> stapler staple .app"
  staple_best_effort "$app"
  echo "==> 公证 OK: $app"
}

notary_submit_wait() {
  local file="$1" out id i
  out="$(xcrun notarytool submit "$file" --keychain-profile "$NOTARY_PROFILE" --output-format plist)"
  id="$(/usr/libexec/PlistBuddy -c 'Print :id' /dev/stdin <<<"$out")"
  echo "    submission id: $id"
  for i in $(seq 1 10); do
    if xcrun notarytool wait "$id" --keychain-profile "$NOTARY_PROFILE" --timeout 30m; then
      xcrun notarytool info "$id" --keychain-profile "$NOTARY_PROFILE" | grep -q "status: Accepted" && return 0
      xcrun notarytool log "$id" --keychain-profile "$NOTARY_PROFILE" || true
      return 1
    fi
    echo "    等待公证结果时网络中断，重试（$i/10）"
    sleep 15
  done
  return 1
}

sign_dmg() {
  local dmg="$1"
  echo "==> 签名 DMG"
  codesign --force "$TS_FLAG" --sign "$SIGN_IDENTITY" "$dmg"
  codesign --verify --verbose=2 "$dmg"
}

notarize_and_staple_dmg() {
  local dmg="$1"
  clear_proxy_for_notary
  echo "==> 提交 DMG 公证, profile=$NOTARY_PROFILE ..."
  notary_submit_wait "$dmg"

  echo "==> stapler staple DMG"
  staple_best_effort "$dmg"
  echo "==> 公证 OK: $dmg"
}

# --- main ---
case "$TARGET" in
  *.app)
    if [[ ! -d "$TARGET" ]]; then
      echo "不是目录形式的 .app: $TARGET" >&2
      exit 1
    fi
    sign_app "$TARGET"
    if [[ "$SIGN_ONLY" -eq 0 ]]; then
      notarize_and_staple_app "$TARGET"
    fi
    ;;
  *.dmg)
    if [[ "$SIGN_ONLY" -eq 1 ]]; then
      sign_dmg "$TARGET"
    else
      # DMG 内 .app 应已签过；这里签 DMG 并公证。
      sign_dmg "$TARGET"
      notarize_and_staple_dmg "$TARGET"
    fi
    ;;
  *)
    echo "仅支持 .app 或 .dmg: $TARGET" >&2
    exit 1
    ;;
esac

echo ""
echo "完成。分发前可自测："
echo "  spctl --assess --type execute -vv \"${TARGET}\""
