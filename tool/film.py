#!/usr/bin/env python3
"""片子缓存与入库（只写本地 library，上云用 otter lib publish）。

  otter film pull <app>          library → films/<app>/shared
  otter film ingest <app>        otter.json site.promo/art → otter-library/<app>/
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from paths import code_root, family_site, films_root, library_root


def pull(app: str) -> None:
    from paths import library_private, library_public

    public = Path(library_public())
    private = Path(library_private())
    films = Path(films_root()) / app
    hub = Path(family_site())
    dest = films / "shared"
    dest.mkdir(parents=True, exist_ok=True)
    brand = dest / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    expr = dest / "expr"
    expr.mkdir(parents=True, exist_ok=True)

    app_brand = public / app
    if app_brand.is_dir():
        subprocess.run(
            [
                "rsync", "-a", "--delete",
                "--exclude", "splash/",
                "--exclude", "macos/",
                "--exclude", "windows/",
                "--exclude", "ios/",
                "--exclude", "android/",
                "--exclude", "shots/",
                "--exclude", "badges/",
                "--exclude", "games/",
                "--exclude", "ai/",
                "--exclude", "store/",
                f"{app_brand}/", f"{brand}/",
            ],
            check=True,
        )
    still270 = public / "expr" / "still" / "270"
    if still270.is_dir():
        subprocess.run(["rsync", "-a", "--delete", f"{still270}/", f"{expr}/"], check=True)
    gsap = hub / "shared" / "vendor" / "gsap.min.js"
    if gsap.is_file():
        shutil.copy2(gsap, brand / "gsap.min.js")
    # 立绘：一律主立绘 private/master/ip/main/
    ip_dir = private / "master" / "ip" / "main"
    for kind, out_name in (("full", "ip_full.png"), ("half", "ip_half.png")):
        src = ip_dir / f"{kind}.png"
        if not src.is_file():
            src = private / "master" / out_name
        if src.is_file():
            shutil.copy2(src, brand / out_name)
    icon = brand / "icon.png"
    if icon.is_file() and not (brand / "family.png").is_file():
        shutil.copy2(icon, brand / "family.png")
    # 片子工程里 assets/still 可软链到 expr（同 270 静图）
    still_link = dest / "still"
    if still_link.is_symlink() or still_link.exists():
        if still_link.is_dir() and not still_link.is_symlink():
            shutil.rmtree(still_link)
        else:
            still_link.unlink(missing_ok=True)
    still_link.symlink_to("expr")
    print(f"shared ← library public/private ({app})")


def _app_cfg(app: str) -> tuple[Path, dict]:
    root = Path(code_root()) / app
    cfg_path = root / "otter.json"
    if not cfg_path.is_file():
        sys.exit(f"找不到 {cfg_path}")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    if cfg.get("id") != app:
        sys.exit(f"otter.json id={cfg.get('id')} 与 {app} 不一致")
    return root, cfg


def ingest(app: str) -> None:
    from paths import library_public

    _, cfg = _app_cfg(app)
    site = cfg.get("site") or {}
    promo = site.get("promo") or {}
    art = site.get("art") or {}
    factory = Path(films_root()) / app
    dest = Path(library_public()) / app
    dest.mkdir(parents=True, exist_ok=True)

    video_rel = promo.get("video")
    if video_rel:
        video = factory / video_rel
        if not video.is_file():
            sys.exit(f"找不到成片：{video}")
        out_mp4 = dest / "promo.mp4"
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error", "-y", "-i", str(video),
                "-vf", "scale=in_range=full:out_range=tv,format=yuv420p",
                "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                "-pix_fmt", "yuv420p", "-color_range", "tv",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", str(out_mp4),
            ],
            check=True,
        )
        print(f"promo.mp4 ← {video.name}")

    def copy_key(key: str, dst_name: str) -> None:
        rel = art.get(key) or promo.get(key)
        if not rel:
            return
        src = factory / rel
        if not src.is_file():
            sys.exit(f"找不到 {key}：{src}")
        shutil.copy2(src, dest / dst_name)
        print(f"{dst_name} ← {src.name}")

    copy_key("poster", "poster.jpg")
    copy_key("og", "og.jpg")
    sub = art.get("subtitle") or promo.get("subtitle")
    if sub:
        src = factory / sub
        if src.is_file():
            shutil.copy2(src, dest / "promo.zh.vtt")
            site_page = Path(family_site()) / app
            if site_page.is_dir():
                shutil.copy2(src, site_page / "promo.zh.vtt")
            print(f"promo.zh.vtt ← {src.name}")

    print(f"本地真相 ← {dest}（上云：otter lib publish）")


def main(argv: list[str]) -> None:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        sys.exit(0 if argv else 1)
    cmd, *rest = argv
    if cmd == "pull":
        if not rest:
            sys.exit("用法：otter film pull <app>")
        pull(rest[0])
    elif cmd == "ingest":
        if not rest:
            sys.exit("用法：otter film ingest <app>")
        ingest(rest[0])
    else:
        sys.exit(f"未知：film {cmd}（pull|ingest）")


if __name__ == "__main__":
    main(sys.argv[1:])
