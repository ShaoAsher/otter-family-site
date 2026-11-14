#!/usr/bin/env bash
# 把 otter_family/brand 成品拷进三端 App 与家族站 shared/icons（brand_build 之后跑一次）。
set -euo pipefail
LIB="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$LIB/.." && pwd)"
CODE="$(cd "$ROOT/.." && pwd)"

git_root="${OTTER_GIT:-$CODE/otter-git}"
tools_root="${OTTER_TOOLS:-$CODE/otter-tools}"
gt_root="${OTTER_GAMETIME:-$CODE/otter-gametime/app}"
shared="$ROOT/shared/icons"

need() { [[ -d "$1" ]] || { echo "缺少目录: $1" >&2; exit 1; }; }
need "$git_root"
need "$tools_root"
need "$gt_root"

cp "$LIB/brand/git/icon.png" "$git_root/assets/brand/otter_git_icon.png"
cp "$LIB/brand/git/mark.png" "$git_root/assets/brand/otter_git_mark.png"
cp "$LIB/brand/common/otter_black.png" "$git_root/assets/brand/otter_black.png"
cp "$LIB/brand/common/otter_white.png" "$git_root/assets/brand/otter_white.png"
rsync -a --delete "$LIB/brand/git/macos/AppIcon.appiconset/" "$git_root/macos/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a --delete "$LIB/brand/git/macos/MenuBarIcon.imageset/" "$git_root/macos/Runner/Assets.xcassets/MenuBarIcon.imageset/"
cp "$LIB/brand/git/windows/app_icon.ico" "$git_root/windows/runner/resources/app_icon.ico"
if [[ -d "$git_root/assets/tray" ]]; then
  cp "$LIB/brand/git/windows/tray_icon.ico" "$git_root/assets/tray/tray_icon.ico"
fi

cp "$LIB/brand/tools/icon.png" "$tools_root/assets/brand/tools_icon.png"
cp "$LIB/brand/tools/logo_badge.png" "$tools_root/assets/brand/tools_badge.png"
cp "$LIB/brand/common/logo_otter.png" "$tools_root/assets/brand/tools_otter.png"
cp "$LIB/brand/common/otter_black.png" "$tools_root/assets/brand/otter_black.png"
cp "$LIB/brand/common/otter_white.png" "$tools_root/assets/brand/otter_white.png"
rsync -a --delete "$LIB/brand/tools/macos/AppIcon.appiconset/" "$tools_root/macos/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a --delete "$LIB/brand/tools/macos/MenuBarIcon.imageset/" "$tools_root/macos/Runner/Assets.xcassets/MenuBarIcon.imageset/"
cp "$LIB/brand/tools/windows/app_icon.ico" "$tools_root/windows/runner/resources/app_icon.ico"

cp "$LIB/brand/gametime/icon.png" "$gt_root/assets/brand/gt_icon.png"
cp "$LIB/brand/gametime/logo_badge.png" "$gt_root/assets/brand/gt_badge.png"
cp "$LIB/brand/common/logo_otter.png" "$gt_root/assets/brand/gt_logo_otter.png"
cp "$LIB/brand/common/otter_white.png" "$gt_root/assets/brand/gt_otter_w.png"
cp "$LIB/brand/common/otter_black.png" "$gt_root/assets/brand/gt_otter_k.png"
rsync -a --delete "$LIB/brand/gametime/ios/AppIcon.appiconset/" "$gt_root/ios/Runner/Assets.xcassets/AppIcon.appiconset/"
rsync -a "$LIB/brand/gametime/android/res/" "$gt_root/android/app/src/main/res/"

mkdir -p "$shared"
cp "$LIB/brand/git/icon.png" "$shared/ottergit.png"
cp "$LIB/brand/tools/icon.png" "$shared/ottertools.png"
cp "$LIB/brand/gametime/icon.png" "$shared/gametime.png"
cp "$LIB/brand/common/otter_white.png" "$shared/otter_white.png"

echo "brand 已拷入 git / tools / gametime 与 shared/icons"