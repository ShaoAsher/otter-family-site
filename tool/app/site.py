#!/usr/bin/env python3
"""出某个 App 官网要用的东西。在 App 根目录执行 ./tool/otter site <命令>，配置读 App 的 otter.json 的 site 段。

  ./tool/otter site demo                 在线试用：原型（不含 *.md）→ 家族仓 <app>/demo/
  ./tool/otter site shots                官网截图：原型按 site.shots 清单截图 → TOS site/<app>/shots/
  ./tool/otter site art                  素材图：读 otter.json 的 site.art（og/poster/字幕）→ TOS；字幕另拷家族仓 <app>/
  ./tool/otter site promo [视频 [字幕 [封面]]]
                                         宣传片：压成 H.264 → TOS promo.mp4，再出一次 art。
                                         不给参数时用 otter.json 的 site.promo（相对工厂 <app>/；成品在片子的 out/）
  ./tool/otter site all                  demo + shots + art；默认宣传片在时再加 promo

在线试用里原型的 ../../assets/otter/expr/、assets/brand/ 改指 TOS library 的 expr/brand（不再另传），
其它 ../../assets/… 复制进 demo/assets/；TOS 上 library/vX/site/<app>/ 与旧 site/<app>/ 双写。

制作工厂（宣传片工程与成品）默认在家族仓旁边的 otter-factory/，可用 OTTER_FACTORY 改。
要先 source ~/.config/devkeys/env.sh（TOS_*）。每步都更新 TOS 上的 build.json。
"""

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
FACTORY = Path(os.environ.get("OTTER_FACTORY") or FAMILY.parent / "otter-factory") / APP

def _demo_brand_key(app: str, name: str) -> str:
    """demo 里 assets/brand/文件名 → library brand 相对路径。"""
    table = {
        "git": {
            "otter_git_icon.png": "git/icon.png",
            "otter_git_mark.png": "git/mark.png",
            "otter_black.png": "common/otter_black.png",
            "otter_white.png": "common/otter_white.png",
        },
        "tools": {
            "tools_icon.png": "tools/icon.png",
            "tools_badge.png": "tools/logo_badge.png",
            "tools_otter.png": "common/logo_otter.png",
            "otter_black.png": "common/otter_black.png",
            "otter_white.png": "common/otter_white.png",
        },
        "gametime": {
            "gt_icon.png": "gametime/icon.png",
            "gt_badge.png": "gametime/logo_badge.png",
            "gt_logo_otter.png": "common/logo_otter.png",
            "gt_otter_w.png": "common/otter_white.png",
            "gt_otter_k.png": "common/otter_black.png",
        },
    }
    return table.get(app, {}).get(name, f"{app}/{name}")

_FAM = json.loads((FAMILY / "family.json").read_text())["family"]
_LIB_VER = _FAM.get("libraryVersion") or "1.1.0"
ASSETS = _FAM["assets"]
EXPR_URL = (_FAM.get("expr") or f"{ASSETS}library/current/expr/").replace("{version}", _LIB_VER)
if not EXPR_URL.endswith("/"):
    EXPR_URL += "/"
BRAND_URL = (_FAM.get("brand") or f"{ASSETS}library/current/brand/").replace("{version}", _LIB_VER)
if not BRAND_URL.endswith("/"):
    BRAND_URL += "/"

VER = re.search(r"^version:\s*([0-9.]+)", (APP_ROOT / "pubspec.yaml").read_text(), re.M).group(1)
MOCKUP = APP_ROOT / SITE["mockup"]

if not (OUT / "index.html").is_file():
    sys.exit(f"找不到官网目录：{OUT}")


def run(*cmd):
    subprocess.run([str(c) for c in cmd], check=True)


def upload(stage, part, *extra):
    run(sys.executable, FAMILY / "tool/site/stamp.py", APP, part, APP_ROOT, stage, *extra)
    run(sys.executable, FAMILY / "tool/release/release.py", "site", APP, stage)


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
        # 品牌图走 TOS library，避免 demo 再拷一份
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
    left = [f"{f.relative_to(dst)}: {m}" for f in dst.rglob("*") if f.suffix in (".html", ".js", ".css")
            for m in re.findall(r"\.\./\S{0,40}", f.read_text())]
    if left:
        sys.exit("仍有指向原型目录之外的相对路径：\n  " + "\n  ".join(left))
    print(f"在线试用：{dst}（{size(dst)}），表情走 {EXPR_URL}")
    with tempfile.TemporaryDirectory() as stage:
        (Path(stage) / "demo").mkdir()
        upload(stage, "demo")


def shots():
    run(sys.executable, FAMILY / "tool/app/assets.py", "pull", APP_ROOT)
    with tempfile.TemporaryDirectory() as stage:
        run("node", FAMILY / "tool/site/shots.mjs", MOCKUP / "index.html", APP_ROOT / SITE["shots"], Path(stage) / "shots")
        upload(stage, "shots")


def _factory_file(key):
    """工厂内相对路径 → 绝对路径；优先 site.art，缺项回落 site.promo。"""
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
        print(f"素材图：{og.name} {poster.name} → TOS，{subtitle.name} → {OUT}")
        upload(stage, "art")


def promo(video=None, subtitle=None, poster=None):
    dflt = SITE.get("promo", {})
    pick = lambda arg, key: Path(arg) if arg else (FACTORY / dflt[key] if key in dflt else None)
    video, subtitle, poster = pick(video, "video"), pick(subtitle, "subtitle"), pick(poster, "poster")
    if not video or not video.is_file():
        sys.exit(f"找不到成片：{video or '（otter.json 没配 site.promo.video，要指定成片路径）'}")
    with tempfile.TemporaryDirectory() as stage:
        run("ffmpeg", "-loglevel", "error", "-y", "-i", video, "-c:v", "libx264", "-preset", "slow", "-crf", "26",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", Path(stage) / "promo.mp4")
        upload(stage, "promo", f"source={video.name}")
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
