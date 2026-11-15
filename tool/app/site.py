#!/usr/bin/env python3
"""官网媒体：只写本地 otter-library/<app>/，上云用 otter lib publish。

  ./tool/otter site demo|shots|art|promo|all
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FAMILY = Path(__file__).resolve().parents[2]
APP_ROOT = Path.cwd()
CFG = json.loads((APP_ROOT / "otter.json").read_text()) if (APP_ROOT / "otter.json").is_file() else None
if not CFG or "site" not in CFG:
    sys.exit(f"要在 App 根目录执行，且 otter.json 有 site 段：{APP_ROOT}")
APP = CFG["id"]
SITE = CFG["site"]
OUT = FAMILY / APP
FACTORY = Path(os.environ.get("OTTER_FILMS") or FAMILY.parent / "otter-films") / APP


def local_site_root() -> Path:
    env = os.environ.get("OTTER_LIBRARY")
    root = Path(env) if env else FAMILY.parent / "otter-library"
    return root / APP


def _demo_brand_key(app: str, name: str) -> str:
    table = {
        "otter-git": {
            "otter_git_icon.png": "otter-git/icon.png",
            "otter_git_mark.png": "otter-git/mark.png",
            "otter_black.png": "common/otter_black.png",
            "otter_white.png": "common/otter_white.png",
        },
        "otter-tools": {
            "tools_icon.png": "otter-tools/icon.png",
            "tools_badge.png": "otter-tools/logo_badge.png",
            "tools_otter.png": "common/logo_otter.png",
            "otter_black.png": "common/otter_black.png",
            "otter_white.png": "common/otter_white.png",
        },
        "otter-gametime": {
            "gt_icon.png": "otter-gametime/icon.png",
            "gt_badge.png": "otter-gametime/logo_badge.png",
            "gt_logo_otter.png": "common/logo_otter.png",
            "gt_otter_w.png": "common/otter_white.png",
            "gt_otter_k.png": "common/otter_black.png",
        },
    }
    return table.get(app, {}).get(name, f"{app}/{name}")


_FAM = json.loads((FAMILY / "family.json").read_text())["family"]
_LIB_VER = _FAM.get("libraryVersion") or "1.0.0"
ASSETS = _FAM["assets"]
EXPR_URL = (_FAM.get("expr") or f"{ASSETS}library/latest/expr/").replace("{version}", _LIB_VER)
if not EXPR_URL.endswith("/"):
    EXPR_URL += "/"
BRAND_URL = (_FAM.get("brand") or f"{ASSETS}library/latest/").replace("{version}", _LIB_VER)
if not BRAND_URL.endswith("/"):
    BRAND_URL += "/"

VER = re.search(r"^version:\s*([0-9.]+)", (APP_ROOT / "pubspec.yaml").read_text(), re.M).group(1)
MOCKUP = APP_ROOT / SITE["mockup"]

if not (OUT / "index.html").is_file():
    sys.exit(f"找不到官网目录：{OUT}")


def run(*cmd):
    subprocess.run([str(c) for c in cmd], check=True)


def mirror_local(stage):
    dest = local_site_root()
    dest.mkdir(parents=True, exist_ok=True)
    for src in Path(stage).rglob("*"):
        if not src.is_file() or src.name.startswith("."):
            continue
        rel = src.relative_to(stage)
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)
    print(f"本地真相 ← {dest}（上云：otter lib publish）")


def commit(stage, part, *extra):
    run(sys.executable, FAMILY / "tool/site/stamp.py", APP, part, APP_ROOT, stage, *extra)
    mirror_local(stage)


def size(path):
    return subprocess.run(["du", "-sh", str(path)], capture_output=True, text=True).stdout.split()[0]


def demo():
    dst = OUT / "demo"
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(MOCKUP, dst, ignore=shutil.ignore_patterns("*.md", ".*"))
    wanted = set()
    for f in sorted(dst.rglob("*")):
        if f.suffix not in (".html", ".js", ".css"):
            continue
        text = f.read_text()
        new = text.replace("../../assets/otter/expr/", EXPR_URL)
        new = re.sub(
            r"\.\./\.\./assets/brand/([\w./-]+\.\w+)",
            lambda m: BRAND_URL + _demo_brand_key(APP, m.group(1)),
            new,
        )
        for ref in re.findall(r"\.\./\.\./(assets/[\w./-]+\.\w+)", new):
            if ref.startswith("assets/brand/"):
                continue
            wanted.add(ref)
        new = re.sub(r"\.\./\.\./(assets/)", r"\1", new)
        new = re.sub(r'\?v=[0-9.]+"', f'?v={VER}"', new)
        if new != text:
            f.write_text(new)
    for ref in sorted(wanted):
        (dst / ref).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(APP_ROOT / ref, dst / ref)
    left = [
        f"{f.relative_to(dst)}: {m}"
        for f in dst.rglob("*")
        if f.suffix in (".html", ".js", ".css")
        for m in re.findall(r"\.\./\S{0,40}", f.read_text())
    ]
    if left:
        sys.exit("仍有指向原型目录之外的相对路径：\n  " + "\n  ".join(left))
    print(f"在线试用：{dst}（{size(dst)}），表情走 {EXPR_URL}")
    with tempfile.TemporaryDirectory() as stage:
        (Path(stage) / "demo").mkdir()
        commit(stage, "demo")


def shots():
    run(sys.executable, FAMILY / "tool/app/assets.py", "pull", APP_ROOT)
    with tempfile.TemporaryDirectory() as stage:
        run(
            "node",
            FAMILY / "tool/site/shots.mjs",
            MOCKUP / "index.html",
            APP_ROOT / SITE["shots"],
            Path(stage) / "shots",
        )
        commit(stage, "shots")


def _factory_file(key):
    art = SITE.get("art") or {}
    promo = SITE.get("promo") or {}
    rel = art.get(key) or promo.get(key)
    return FACTORY / rel if rel else None


def art():
    og, poster, subtitle = _factory_file("og"), _factory_file("poster"), _factory_file("subtitle")
    missing = [n for n, p in (("og", og), ("poster", poster), ("subtitle", subtitle)) if not p or not p.is_file()]
    if missing:
        sys.exit(f"找不到素材（otter.json site.art / site.promo）：{', '.join(missing)}")
    with tempfile.TemporaryDirectory() as stage:
        shutil.copy2(og, Path(stage) / "og.jpg")
        shutil.copy2(poster, Path(stage) / "poster.jpg")
        shutil.copy2(subtitle, OUT / "promo.zh.vtt")
        print(f"素材图：{og.name} {poster.name} → library，{subtitle.name} → {OUT}")
        commit(stage, "art")


def promo(video=None, subtitle=None, poster=None):
    dflt = SITE.get("promo", {})
    pick = lambda arg, key: Path(arg) if arg else (FACTORY / dflt[key] if key in dflt else None)
    video, subtitle, poster = pick(video, "video"), pick(subtitle, "subtitle"), pick(poster, "poster")
    if not video or not video.is_file():
        sys.exit(f"找不到成片：{video or '（otter.json 没配 site.promo.video）'}")
    with tempfile.TemporaryDirectory() as stage:
        run(
            "ffmpeg", "-loglevel", "error", "-y", "-i", video,
            "-c:v", "libx264", "-preset", "slow", "-crf", "26",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", Path(stage) / "promo.mp4",
        )
        commit(stage, "promo", f"source={video.name}")
    art()


def main(argv):
    cmd = argv[0] if argv else ""
    if cmd == "demo":
        demo()
    elif cmd == "shots":
        shots()
    elif cmd == "art":
        art()
    elif cmd == "promo":
        promo(*argv[1:4])
    elif cmd == "all":
        demo()
        shots()
        art()
        video = SITE.get("promo", {}).get("video")
        if video and (FACTORY / video).is_file():
            promo()
        else:
            print("没有默认宣传片，跳过 promo")
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
