#!/usr/bin/env bash
# 从本地真相 library/brand 或 TOS library/current 写入三端 App。
set -euo pipefail
LIB="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$LIB/.." && pwd)"
CODE="$(cd "$ROOT/.." && pwd)"
TRUTH="$LIB/library/brand"

git_root="${OTTER_GIT:-$CODE/otter-git}"
tools_root="${OTTER_TOOLS:-$CODE/otter-tools}"
gt_root="${OTTER_GAMETIME:-$CODE/otter-gametime/app}"

if python3 "$ROOT/tool/app/assets.py" pull brand "$git_root" \
  && python3 "$ROOT/tool/app/assets.py" pull brand "$tools_root" \
  && python3 "$ROOT/tool/app/assets.py" pull brand "$gt_root"; then
  echo "brand ← TOS library/current → 三端 App"
  exit 0
fi

echo "TOS pull 失败，回落本地 $TRUTH" >&2
[[ -d "$TRUTH/git" ]] || { echo "缺少 $TRUTH"; exit 1; }
cp "$TRUTH/git/icon.png" "$git_root/assets/brand/otter_git_icon.png"
cp "$TRUTH/git/mark.png" "$git_root/assets/brand/otter_git_mark.png"
cp "$TRUTH/common/otter_black.png" "$git_root/assets/brand/otter_black.png"
cp "$TRUTH/common/otter_white.png" "$git_root/assets/brand/otter_white.png"
rsync -a --delete "$TRUTH/git/macos/AppIcon.appiconset/" "$git_root/macos/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a --delete "$TRUTH/git/macos/MenuBarIcon.imageset/" "$git_root/macos/Runner/Assets.xcassets/MenuBarIcon.imageset/"
cp "$TRUTH/git/windows/app_icon.ico" "$git_root/windows/runner/resources/app_icon.ico"
[[ -d "$git_root/assets/tray" ]] && cp "$TRUTH/git/windows/tray_icon.ico" "$git_root/assets/tray/tray_icon.ico"

cp "$TRUTH/tools/icon.png" "$tools_root/assets/brand/tools_icon.png"
cp "$TRUTH/tools/logo_badge.png" "$tools_root/assets/brand/tools_badge.png"
cp "$TRUTH/common/logo_otter.png" "$tools_root/assets/brand/tools_otter.png"
cp "$TRUTH/common/otter_black.png" "$tools_root/assets/brand/otter_black.png"
cp "$TRUTH/common/otter_white.png" "$tools_root/assets/brand/otter_white.png"
rsync -a --delete "$TRUTH/tools/macos/AppIcon.appiconset/" "$tools_root/macos/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a --delete "$TRUTH/tools/macos/MenuBarIcon.imageset/" "$tools_root/macos/Runner/Assets.xcassets/MenuBarIcon.imageset/"
cp "$TRUTH/tools/windows/app_icon.ico" "$tools_root/windows/runner/resources/app_icon.ico"

cp "$TRUTH/gametime/icon.png" "$gt_root/assets/brand/gt_icon.png"
cp "$TRUTH/gametime/logo_badge.png" "$gt_root/assets/brand/gt_badge.png"
cp "$TRUTH/common/logo_otter.png" "$gt_root/assets/brand/gt_logo_otter.png"
cp "$TRUTH/common/otter_white.png" "$gt_root/assets/brand/gt_otter_w.png"
cp "$TRUTH/common/otter_black.png" "$gt_root/assets/brand/gt_otter_k.png"
rsync -a --delete "$TRUTH/gametime/ios/AppIcon.appiconset/" "$gt_root/ios/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a "$TRUTH/gametime/android/res/" "$gt_root/android/app/src/main/res/"
echo "brand ← 本地 library/brand → 三端 App"
