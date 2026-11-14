#!/usr/bin/env python3
"""用新剪影母版重烤三端 master 图标上的水獭，再跑 brand_build。

  python3 source/patch_silhouette.py [剪影图，默认 .drafts/icons/silhouette-curled-final.jpg]

圆盘内（除徽章）整块重绘渐变，再贴新剪影，避免旧墨迹/水滴/高光残影。
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "brand" / "master"
sys.path.insert(0, str(Path(__file__).parent))
import brand_build as bb  # noqa: E402

GRADS = {
    "git": ((255, 214, 107), (232, 155, 12)),
    "tools": ((255, 176, 74), (250, 90, 30)),
    "gametime": ((92, 242, 222), (31, 182, 255)),
}


def load_silhouette(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    # 生图 JPG 里常有米黄「镂空」假高光，按亮度一律打成纯黑剪影，避免贴在圆盘上像旧图残影
    gray = im.convert("L")
    a = gray.point(lambda v: 0 if v > 238 else 255)
    out = Image.new("RGBA", im.size, (*bb.INK, 255))
    out.putalpha(a)
    out = out.crop(out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    return bb.square(out, 0.04)


def disc_and_badge(tile: Image.Image) -> tuple[float, float, float, tuple[float, float, float]]:
    w = tile.width
    r, g, b = tile.split()
    bright = ImageChops.lighter(r, ImageChops.lighter(g, b))
    pts = []
    for i in range(144):
        t = math.radians(i * 2.5)
        if 10 <= i * 2.5 <= 80:
            continue
        for k in range(round(w * 0.49), round(w * 0.2), -1):
            x, y = w / 2 + k * math.cos(t), w / 2 + k * math.sin(t)
            if bright.getpixel((round(x), round(y))) > bb.DISC_THRESHOLD:
                pts.append((x, y))
                break
    dcx, dcy, dr = bb.fit_circle(pts)

    white = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v > 200 else 0)
    seed = None
    for k in range(round(w * 0.68), round(dr * 0.5), -1):
        x, y = round(dcx + k * 0.7071), round(dcy + k * 0.7071)
        if 0 <= x < w and 0 <= y < w and white.getpixel((x, y)) == 255:
            seed = (x, y)
            break
    if seed is None:
        raise SystemExit("没找到徽章")
    ImageDraw.floodfill(white, seed, 128)
    x0, y0, x1, y1 = white.point(lambda v: 255 if v == 128 else 0).getbbox()
    badge_c = ((x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2)
    return dcx, dcy, dr, badge_c


def lerp3(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def disc_rgb(dcx, dcy, dr, x, y, inner, outer) -> tuple[int, int, int]:
    d = math.hypot(x - dcx, y - dcy) / max(dr, 1)
    t = min(1.0, d**0.82)
    c = lerp3(inner, outer, t)
    if d < 0.32:
        c = lerp3(c, (255, 255, 255), (0.32 - d) * 0.55)
    return c


def patch_master(app: str, sil: Image.Image) -> None:
    path = MASTER / f"{app}.png"
    tile = bb.full_bleed(Image.open(path))
    w = tile.width
    dcx, dcy, dr, badge = disc_and_badge(tile)
    bx, by, br = badge
    inner, outer = GRADS[app]
    out = tile.copy().convert("RGBA")
    orig = tile.convert("RGBA")
    opx = out.load()
    tpx = orig.load()

    for y in range(w):
        for x in range(w):
            if math.hypot(x - bx, y - by) <= br * 1.14:
                continue
            d = math.hypot(x - dcx, y - dcy)
            if d > dr:
                continue
            c = disc_rgb(dcx, dcy, dr, x, y, inner, outer)
            if d > dr * 0.9:
                t = (d - dr * 0.9) / (dr * 0.1)
                o = tpx[x, y][:3]
                c = lerp3(c, o, t * 0.65)
            opx[x, y] = (*c, 255)

    target = round(1.44 * dr)
    scale = target / max(sil.width, sil.height)
    nw, nh = round(sil.width * scale), round(sil.height * scale)
    ot = sil.resize((nw, nh), Image.LANCZOS)
    ox = round(dcx + 0.03 * dr - nw / 2)
    oy = round(dcy + 0.05 * dr - nh / 2)
    out.alpha_composite(ot, (ox, oy))
    out.save(path, optimize=True)
    print(f"patched master/{app}.png")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / ".drafts/icons/silhouette-curled-final.jpg"
    sil = load_silhouette(src)
    sil.save(MASTER / "silhouette.png", optimize=True)
    print("silhouette.png ok", sil.size)
    for app in bb.APPS:
        patch_master(app, sil)
    bb.main()


if __name__ == "__main__":
    main()