#!/usr/bin/env python3
"""出某个 App 官网要用的东西。在 App 根目录执行 ./tool/otter site <命令>，配置读 App 的 otter.json 的 site 段。

  ./tool/otter site demo                 在线试用：原型（不含 *.md）→ 家族仓 <app>/demo/
  ./tool/otter site shots                官网截图：原型按 site.shots 清单截图 → TOS site/<app>/shots/
  ./tool/otter site art                  素材图：工厂 out/ 的 og.jpg、poster.jpg → TOS；promo.zh.vtt → 家族仓 <app>/（要同域）
  ./tool/otter site promo [视频 [字幕 [封面]]]
                                         宣传片：压成 H.264 → TOS promo.mp4；字幕、封面更新到工厂 out/ 再出一次 art。
                                         不给参数时用 otter.json 的 site.promo（相对工厂 <app>/）
  ./tool/otter site all                  demo + shots + art；默认宣传片在时再加 promo

在线试用里原型的 ../../assets/otter/expr/ 改指 TOS 的公开表情包 expr/<版本>/（不再另传），
其它 ../../assets/… 复制进 demo/assets/；TOS 上 site/<app>/demo/ 清空（旧的表情副本会被删掉）。

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
ASSETS = json.loads((FAMILY / "family.json").read_text())["family"]["assets"]
EXPR_URL = f"{ASSETS}expr/{CFG['expr']['version']}/"
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
        for ref in re.findall(r"\.\./\.\./(assets/[\w./-]+\.\w+)", new):
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


def art():
    out = FACTORY / "out"
    with tempfile.TemporaryDirectory() as stage:
        for n in ("og.jpg", "poster.jpg"):
            shutil.copy2(out / n, stage)
        shutil.copy2(out / "promo.zh.vtt", OUT / "promo.zh.vtt")
        print(f"素材图：og.jpg poster.jpg → TOS，promo.zh.vtt → {OUT}")
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
    out = FACTORY / "out"
    out.mkdir(parents=True, exist_ok=True)
    if subtitle and subtitle.is_file():
        shutil.copy2(subtitle, out / "promo.zh.vtt")
    if poster and poster.is_file():
        shutil.copy2(poster, out / "poster.jpg")
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
