#!/usr/bin/env bash
# App 侧 ./tool/otter 的唯一实现（各 App 仓库只做 exec 转发，避免三份漂移）。
# 调用前须已 cd 到 App 根目录（含 otter.json）。
set -euo pipefail

dir="${FAMILY_SITE:-../otter-family-site}"
if [[ ! -f "$dir/tool/otter" ]]; then
  case "${1:-}" in
    release|site|ship|publish|mirror|launch)
      echo "找不到水獭家族仓：$dir" >&2
      echo "先 clone otter-family-site 到本仓库旁边，或用 FAMILY_SITE 指定" >&2
      exit 1 ;;
  esac
  dir="${OTTER_CACHE:-$HOME/.cache/otter-family}/otter-family-site"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" pull -q --ff-only 2>/dev/null || true
  else
    mkdir -p "$(dirname "$dir")"
    git clone -q --depth 1 https://github.com/ShaoAsher/otter-family-site.git "$dir"
  fi
  echo "用家族仓缓存：$dir" >&2
fi
exec bash "$dir/tool/otter" "$@"