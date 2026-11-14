#!/usr/bin/env bash
# 水獭家族 macOS App 共用发版：打包（默认公证）后交给 tool/release.py 上传（国内 TOS + 海外 GitHub Release）。
# 在 App 根目录执行（App 的 tool/release.sh 会转到这里），App 标识与产物名读 otter.json。
#
# 用法：
#   ./tool/release.sh                  # 编译 + 打包 + 上传（默认公证）
#   ./tool/release.sh --skip-build     # 跳过编译，用已有 Release 产物
#   ./tool/release.sh --no-notarize    # 不签名公证（仅自测）
#   ./tool/release.sh --zip-only       # 只上传 ZIP
#   ./tool/release.sh --use-dist       # 不再打包，直接上传 dist 里最新的已公证产物（含 Windows 包）
#
# 需已 gh auth login，并先 source ~/.config/devkeys/env.sh（TOS_*）。
#
# 只能在 git-flow 的发布分支 release 上运行：工作区干净、已与 origin/release 同步、
# 当前提交已打 v<版本> 标签（git flow release finish 会打）。自测可设 OTTER_RELEASE_ANY_BRANCH=1 跳过。
#
# 上传、校验与切换下载版本都在 tool/release.py：两处都齐了才会把 family.json 的 download.version
# 切到这一版。Windows 包由 CI 传到 GitHub（标签 <app>-v<版本>），之后 release.py mirror 补到 TOS；
# 一条龙见 tool/ship.py。

set -euo pipefail

ROOT="$PWD"
HERE="$(cd "$(dirname "$0")" && pwd)"
FAMILY="$(cd "$HERE/../.." && pwd)"
RELEASE_PY="$FAMILY/tool/release.py"
PACKAGE_SH="$HERE/package.sh"
[[ -f "$ROOT/otter.json" && -f "$ROOT/pubspec.yaml" ]] || {
  echo "要在 App 根目录执行（需要 otter.json 与 pubspec.yaml）：$ROOT" >&2
  exit 1
}
APP="$(python3 -c 'import json; print(json.load(open("otter.json"))["app"])')"
ARTIFACT="$(python3 -c 'import json; print(json.load(open("otter.json"))["mac"]["artifact"])')"
VERSION="$(awk '/^version:/ {print $2; exit}' pubspec.yaml | tr -d '"' | cut -d+ -f1)"
TAG="v${VERSION}"

NOTARIZE=1
ZIP_ONLY=0
USE_DIST=0
PACKAGE_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) PACKAGE_ARGS+=(--skip-build); shift ;;
    --no-notarize) NOTARIZE=0; shift ;;
    --zip-only) ZIP_ONLY=1; PACKAGE_ARGS+=(--zip-only); shift ;;
    --use-dist) USE_DIST=1; shift ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$NOTARIZE" -eq 1 ]]; then
  PACKAGE_ARGS+=(--notarize)
fi

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令: $1" >&2
    exit 1
  }
}

need gh
need flutter
need python3

if [[ "${OTTER_RELEASE_ANY_BRANCH:-0}" != "1" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$BRANCH" == "release" ]] || {
    echo "只能在 release 分支发布（当前 ${BRANCH}）。先 git flow release finish，再 git checkout release" >&2
    exit 1
  }
  [[ -z "$(git status --porcelain)" ]] || {
    echo "工作区有未提交改动，先提交或还原" >&2
    exit 1
  }
  git fetch -q origin release
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/release)" ]] || {
    echo "release 与 origin/release 不一致，先 git push origin release（或 git pull）" >&2
    exit 1
  }
  [[ "$(git rev-parse -q --verify "refs/tags/$TAG^{commit}" || true)" == "$(git rev-parse HEAD)" ]] || {
    echo "当前提交没有 $TAG 标签。git flow release finish 会打；版本号见 pubspec.yaml" >&2
    exit 1
  }
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "未登录 GitHub。请先: gh auth login" >&2
  exit 1
fi

HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  arm64|ARM64) ARCH_LABEL="arm64" ;;
  x86_64) ARCH_LABEL="x86_64" ;;
  *) ARCH_LABEL="$HOST_ARCH" ;;
esac

STABLE_DMG="${ARTIFACT}-macos-${ARCH_LABEL}.dmg"
STABLE_ZIP="${ARTIFACT}-macos-${ARCH_LABEL}.zip"
STABLE_WIN="${ARTIFACT}-windows-x64.zip"
STABLE_WIN_SETUP="${ARTIFACT}-windows-x64-setup.exe"

if [[ "$USE_DIST" -eq 1 ]]; then
  echo "==> 使用 dist 现有产物 v${VERSION} → ${APP}-v${VERSION}"
else
  echo "==> 打包 v${VERSION} → ${APP}-v${VERSION}"
  bash "$PACKAGE_SH" "${PACKAGE_ARGS[@]}"
fi

DIST_DIR="$ROOT/dist"
# 取本次最新产物（按修改时间）
DMG_SRC="$(ls -t "$DIST_DIR"/*-macos-*.dmg 2>/dev/null | head -1 || true)"
ZIP_SRC="$(ls -t "$DIST_DIR"/*-macos-*.zip 2>/dev/null | head -1 || true)"
WIN_SRC="$(ls -t "$DIST_DIR"/*-windows-x64-*.zip 2>/dev/null | head -1 || true)"
WIN_SETUP_SRC="$(ls -t "$DIST_DIR"/*-windows-x64-*-setup.exe 2>/dev/null | head -1 || true)"

if [[ "$ZIP_ONLY" -eq 0 ]]; then
  [[ -n "$DMG_SRC" && -f "$DMG_SRC" ]] || {
    echo "找不到 DMG 产物（$DIST_DIR）" >&2
    exit 1
  }
fi
[[ -n "$ZIP_SRC" && -f "$ZIP_SRC" ]] || {
  echo "找不到 ZIP 产物（$DIST_DIR）" >&2
  exit 1
}

STAGE_UPLOAD="$(mktemp -d)"
trap 'rm -rf "$STAGE_UPLOAD"' EXIT

UPLOAD_FILES=()
if [[ "$ZIP_ONLY" -eq 0 ]]; then
  cp "$DMG_SRC" "$STAGE_UPLOAD/$STABLE_DMG"
  UPLOAD_FILES+=("$STAGE_UPLOAD/$STABLE_DMG")
  echo "==> DMG  $DMG_SRC → $STABLE_DMG"
fi
cp "$ZIP_SRC" "$STAGE_UPLOAD/$STABLE_ZIP"
UPLOAD_FILES+=("$STAGE_UPLOAD/$STABLE_ZIP")
echo "==> ZIP  $ZIP_SRC → $STABLE_ZIP"
if [[ -n "$WIN_SRC" ]]; then
  cp "$WIN_SRC" "$STAGE_UPLOAD/$STABLE_WIN"
  UPLOAD_FILES+=("$STAGE_UPLOAD/$STABLE_WIN")
  echo "==> WIN  $WIN_SRC → $STABLE_WIN"
fi
if [[ -n "$WIN_SETUP_SRC" ]]; then
  cp "$WIN_SETUP_SRC" "$STAGE_UPLOAD/$STABLE_WIN_SETUP"
  UPLOAD_FILES+=("$STAGE_UPLOAD/$STABLE_WIN_SETUP")
  echo "==> WIN  $WIN_SETUP_SRC → $STABLE_WIN_SETUP"
fi

echo "==> 发布到 TOS + GitHub（${APP}-v${VERSION}）"
python3 "$RELEASE_PY" publish "$APP" "$VERSION" "${UPLOAD_FILES[@]}"

# 上传成功后清理 dist：只保留本次上传的包，旧版本与中间目录清掉。
echo "==> 清理 dist 旧产物（保留本次上传的包）"
shopt -s nullglob
for f in "$DIST_DIR"/*.dmg "$DIST_DIR"/*.zip "$DIST_DIR"/*.exe; do
  keep=0
  [[ -n "$DMG_SRC" && "$f" == "$DMG_SRC" ]] && keep=1
  [[ -n "$ZIP_SRC" && "$f" == "$ZIP_SRC" ]] && keep=1
  [[ -n "$WIN_SRC" && "$f" == "$WIN_SRC" ]] && keep=1
  [[ -n "$WIN_SETUP_SRC" && "$f" == "$WIN_SETUP_SRC" ]] && keep=1
  if [[ "$keep" -eq 0 ]]; then
    echo "    删除 $(basename "$f")"
    rm -f "$f"
  fi
done
shopt -u nullglob
rm -rf "$DIST_DIR/stage-macos" "$DIST_DIR/dmg-root"

echo ""
echo "发布完成。两处是否齐全：python3 \"$RELEASE_PY\" status ${APP}"
