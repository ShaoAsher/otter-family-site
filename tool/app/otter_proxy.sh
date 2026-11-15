#!/usr/bin/env bash
# App 仓 ./tool/otter → 枢纽仓 tool/otter
set -euo pipefail
app="$(pwd)"
dir="${FAMILY_SITE:-../otter-site}"
if [[ ! -f "$dir/tool/otter" ]]; then
  echo "找不到枢纽仓 tool/otter（期望 $dir，或设 FAMILY_SITE）" >&2
  exit 1
fi
export FAMILY_SITE="$(cd "$dir" && pwd)"
cd "$app"
exec bash "$FAMILY_SITE/tool/otter" "$@"
