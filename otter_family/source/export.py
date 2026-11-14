#!/usr/bin/env python3
"""表情导出：source/still_1024/*.jpg + source/video_720/*.mp4（绿幕）→ expr/ 下透明 WebP

  expr/still_{1080,540,270}/、expr/anim_{540,270}/ + expr/manifest.json

用法：python3 source/export.py [key ...]   # 不带参数则处理全部；已存在且比源新的会跳过；结束后刷新 manifest
"""
import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.dirname(os.path.abspath(__file__))
WEBP = f"{os.path.dirname(SRC)}/expr"
RAW_STILL = f"{SRC}/still_1024"
RAW_ANIM = f"{SRC}/video_720"
STILL_DIRS = {s: f"{WEBP}/still_{s}" for s in (1080, 540, 270)}
ANIM_DIRS = {s: f"{WEBP}/anim_{s}" for s in (540, 270)}
ANIM_FPS = 12


def chroma_key(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    dom = g - np.maximum(r, b)
    lo, hi = 25, 95
    bg = max(np.median(c) for c in (dom[:12, :12], dom[:12, -12:], dom[-12:, :12], dom[-12:, -12:]))
    if 30 < bg < hi:  # 生成时偶尔出暗绿底，按实际底色收紧阈值
        lo, hi = bg * 0.2, bg * 0.75
    alpha = np.clip(1 - (dom - lo) / (hi - lo), 0, 1)
    g = np.minimum(g, np.maximum(r, b) + 4)
    rgb = np.dstack([r, g, b]).clip(0, 255).astype(np.uint8)
    am = Image.fromarray((alpha * 255).astype(np.uint8))
    am = am.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    am = am.point(lambda v: 0 if v < 8 else (255 if v > 247 else v))
    out = Image.fromarray(rgb).convert("RGBA")
    out.putalpha(am)
    return out


def fresh(dst, src):
    return os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)


def export_still(key):
    src = f"{RAW_STILL}/{key}.jpg"
    dsts = {s: f"{d}/{key}.webp" for s, d in STILL_DIRS.items()}
    if all(fresh(d, src) for d in dsts.values()):
        return
    im = chroma_key(Image.open(src))
    for s, d in dsts.items():
        os.makedirs(os.path.dirname(d), exist_ok=True)
        im.resize((s, s), Image.LANCZOS).save(d, quality=90, method=6)


def export_anim(key):
    src = f"{RAW_ANIM}/{key}.mp4"
    dsts = {s: f"{d}/{key}.webp" for s, d in ANIM_DIRS.items()}
    if all(fresh(d, src) for d in dsts.values()):
        return
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src,
                        "-vf", f"fps={ANIM_FPS}", f"{tmp}/%03d.png"], check=True)
        frames = [chroma_key(Image.open(f)) for f in sorted(glob.glob(f"{tmp}/*.png"))]
    for s, d in dsts.items():
        os.makedirs(os.path.dirname(d), exist_ok=True)
        x = [f.resize((s, s), Image.LANCZOS) for f in frames]
        x[0].save(d, save_all=True, append_images=x[1:], duration=round(1000 / ANIM_FPS), loop=0,
                  quality=70, alpha_quality=50, method=4, minimize_size=True)


def export_key(k):
    if os.path.exists(f"{RAW_STILL}/{k}.jpg"):
        export_still(k)
    if os.path.exists(f"{RAW_ANIM}/{k}.mp4"):
        export_anim(k)
    return k


def write_manifest():
    import hashlib
    import json
    import time
    names = {i["k"]: i["zh"] for i in json.load(open(f"{SRC}/v3_plan.json"))["items"]}
    items = []
    for f in sorted(glob.glob(f"{ANIM_DIRS[540]}/*.webp")):
        k = os.path.basename(f)[:-5]
        data = open(f, "rb").read()
        items.append({"key": k, "zh": names.get(k, ""), "path": f"anim_540/{k}.webp",
                      "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {"version": time.strftime("%Y%m%d%H%M"), "size": 540, "fps": ANIM_FPS, "items": items}
    with open(f"{WEBP}/manifest.json", "w") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=1)


def main():
    keys = sys.argv[1:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(f"{RAW_STILL}/*.jpg"))
    jobs = int(os.environ.get("JOBS", "1"))
    if jobs <= 1:
        for k in keys:
            print("ok", export_key(k), flush=True)
        write_manifest()
        return
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(jobs) as ex:
        for k in ex.map(export_key, keys):
            print("ok", k, flush=True)
    write_manifest()


if __name__ == "__main__":
    main()
