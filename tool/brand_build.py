#!/usr/bin/env python3
"""master/brand/{app}/ → common/ + brand/{app}/ + platform/{app}/。

母版唯一源：`master/brand/{app}/{icon,dart,anim}`。
`anim.mp4` 上 OSS，不进 App 安装包；包内只 pull `dart.png` 作兜底。

  ./tool/otter lib brand
"""
from __future__ import annotations

import json
import os
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from paths import family_site, library_root

BRAND = library_root()
MASTER = f"{BRAND}/master"
MASTER_BRAND = f"{MASTER}/brand"
FAMILY_JSON = f"{family_site()}/family.json"
INK = (11, 10, 20)
WHITE = (255, 255, 255)
SPLASH_BG = (11, 10, 20)  # #0B0A14
# App 图标 / 产品标上的剪影与角标用白色（色底上更干净）；菜单栏模板仍用墨色。
ICON_GLYPH = WHITE
APPS = {"otter-git": "desktop", "otter-tools": "desktop", "otter-gametime": "mobile"}

RADIUS = 0.225
# 角标方案（右上、无圆底、墨色符号）：
# - 水獭占中下方，面孔在上半区；角标放右上圆角安全区，避开五官，扫一眼能分 App。
# - 只有分支 / 扳手 / 手柄符号，不要白圆底；相对边长约 13%，中心锚在 (84%, 17%)。
ICON_BADGE = {
    "otter-git": {"scale": 0.215, "anchor": (0.80, 0.195)},
    "otter-tools": {"scale": 0.215, "anchor": (0.80, 0.195)},
    "otter-gametime": {"scale": 0.20, "anchor": (0.80, 0.18)},
}
# 源图方块自带约 12% 圆角，圆角外是白底或深底；四周各裁 4.2% 就全落在方块内。
INSET = 0.042
# 圆盘边缘：圆盘最暗处的最大通道值 > 195，外圈光晕 < 115。
DISC_THRESHOLD = 150


def write(im: Image.Image, path: str, size: int | None = None) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = im.resize((size, size), Image.LANCZOS) if size else im
    # LANCZOS 会把不透明色渗进透明边，保存前清掉，避免白四角
    if out.mode == "RGBA" or "A" in out.getbands():
        out = clear_transparent_rgb(out.convert("RGBA"))
    out.save(path, optimize=True)


def write_json(data: dict, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def rounded(im: Image.Image, radius: float) -> Image.Image:
    w, h = im.size
    mask = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=radius * 4, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask.resize((w, h), Image.LANCZOS))
    return out


def clear_transparent_rgb(im: Image.Image, thresh: int = 8) -> Image.Image:
    """透明像素 RGB 清零，避免圆角外残留白底在合成时冒出「白四角」。"""
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    gone = a.point(lambda v: 255 if v <= thresh else 0)
    empty = Image.new("RGBA", im.size, (0, 0, 0, 0))
    return Image.composite(empty, im, gone)


def ensure_rounded(im: Image.Image, radius_frac: float = RADIUS) -> Image.Image:
    """母版已是透明圆角则不再套一层，避免图标越缩越小。"""
    im = im.convert("RGBA")
    if im.getpixel((0, 0))[3] < 16:
        return clear_transparent_rgb(im)
    return clear_transparent_rgb(rounded(im, im.width * radius_frac))


def flatten_opaque(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """iOS Marketing 1024 禁止透明：圆角图铺到品牌色实底上。"""
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, rgb + (255,))
    return Image.alpha_composite(bg, im).convert("RGB")


def square(im: Image.Image, margin: float) -> Image.Image:
    """按 alpha 贴边裁切，再居中放进带 margin 的透明方图。"""
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    side = round(max(im.size) * (1 + 2 * margin))
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return out


def full_bleed(src: Image.Image) -> Image.Image:
    """裁到方块内部；圆角较大的源图四角仍会残留圆角外的底色，用方块边缘色补平。"""
    d = round(src.width * INSET)
    tile = src.crop((d, d, src.width - d, src.height - d)).convert("RGB")
    w, h = tile.size
    ground = tile.getpixel((w // 2, round(h * 0.01)))
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if min(tile.getpixel(seed)) > 200:
            ImageDraw.floodfill(tile, seed, ground, thresh=120)
    return tile


def fit_circle(pts: list[tuple[float, float]]) -> tuple[float, float, float]:
    """代数最小二乘拟合圆，剔除残差大的点后再拟合一次。"""
    import numpy as np

    p = np.array(pts, dtype=float)
    for _ in range(2):
        a = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
        cx, cy, c = np.linalg.lstsq(a, (p ** 2).sum(1), rcond=None)[0]
        r = (c + cx * cx + cy * cy) ** 0.5
        res = np.abs(np.hypot(p[:, 0] - cx, p[:, 1] - cy) - r)
        p = p[res <= max(2.0, 2.5 * np.median(res))]
    return cx, cy, r


def circle_mask(size: int, circles: list[tuple[float, float, float]]) -> Image.Image:
    ss = 4
    m = Image.new("L", (size * ss, size * ss), 0)
    d = ImageDraw.Draw(m)
    for cx, cy, r in circles:
        d.ellipse(((cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def mark_and_layers(tile: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    """深底方块 → 透明产品标 + 分层 logo 的水獭层与徽章层。

    圆盘外常有大片光晕，按亮度阈值抠会把光晕带进来，所以按几何来：沿射线由外向内找圆盘边缘
    （圆盘最暗处 > 195，光晕 < 115）拟合出圆盘；再沿右下 45° 由外向内找到徽章白边，洪泛出整枚白圆取外接圆。
    蒙版 = 圆盘 ∪ 徽章，两圆各收 1.5px 避开边缘的光晕混色。
    """
    import math

    w = tile.width
    r, g, b = tile.split()
    bright = ImageChops.lighter(r, ImageChops.lighter(g, b))
    pts = []
    for i in range(144):
        t = math.radians(i * 2.5)
        if 10 <= i * 2.5 <= 80:  # 徽章所在的右下方向
            continue
        for k in range(round(w * 0.49), round(w * 0.2), -1):
            x, y = w / 2 + k * math.cos(t), w / 2 + k * math.sin(t)
            if bright.getpixel((round(x), round(y))) > DISC_THRESHOLD:
                pts.append((x, y))
                break
    dcx, dcy, dr = fit_circle(pts)

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

    disc_c = (dcx, dcy, dr - 1.5)
    badge_c = (badge_c[0], badge_c[1], badge_c[2] + 1)
    mark = tile.convert("RGBA")
    mark.putalpha(circle_mask(w, [disc_c, badge_c]))
    badge = tile.convert("RGBA")
    badge.putalpha(circle_mask(w, [badge_c]))

    x0, y0, x1, y1 = mark.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    side = round(max(x1 - x0, y1 - y0) * 1.02)
    box = ((x0 + x1 - side) // 2, (y0 + y1 - side) // 2)
    box = (*box, box[0] + side, box[1] + side)

    # 分层动效用：画布 = 圆盘外接正方形。水獭层取圆盘内的深色墨迹（避开徽章及其暗圈），徽章层取白圆。
    disc_box = tuple(round(v) for v in (dcx - dr, dcy - dr, dcx + dr, dcy + dr))
    ink = bright.point(lambda v: max(0, min(255, (170 - v) * 255 // 110)))
    ink = ImageChops.multiply(ink, circle_mask(w, [disc_c]))
    ink = ImageChops.subtract(ink, circle_mask(w, [(badge_c[0], badge_c[1], badge_c[2] * 1.12)]))
    otter = Image.new("RGBA", (w, w), INK)
    otter.putalpha(ink)
    badge_layer = Image.new("RGBA", (w, w), (11, 10, 20, 0))
    badge_layer.putalpha(circle_mask(w, [(badge_c[0], badge_c[1], badge_c[2] * 1.07)]))
    badge_layer.alpha_composite(badge)
    return mark.crop(box), otter.crop(disc_box), badge_layer.crop(disc_box)


def _hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def app_colors() -> dict[str, tuple[tuple[int, int, int], tuple[int, int, int]]]:
    data = json.load(open(FAMILY_JSON, encoding="utf-8"))
    out = {}
    for app, meta in data["apps"].items():
        cs = meta.get("colors")
        if cs and len(cs) >= 2:
            out[app] = (_hex_rgb(cs[0]), _hex_rgb(cs[1]))
    return out


def gradient_background(side: int, edge: tuple[int, int, int], center: tuple[int, int, int]) -> Image.Image:
    """品牌渐变色铺满方图（中心亮、四角偏深），无圆形边界。"""
    im = Image.new("RGB", (side, side))
    px = im.load()
    cx, cy = side * 0.5, side * 0.44
    max_r = side * 0.78
    for y in range(side):
        for x in range(side):
            d = min(1.0, (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / max_r)
            d = d * d
            px[x, y] = tuple(int(center[i] * (1 - d) + edge[i] * d) for i in range(3))
    return im.convert("RGBA")


def _place_silhouette(
    canvas: Image.Image,
    silhouette: Image.Image,
    side: int,
    fill_ratio: float = 0.84,
    fill: tuple[int, int, int] = INK,
) -> None:
    sil = silhouette.convert("RGBA")
    bbox = sil.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return
    sil = sil.crop(bbox)
    target = int(side * fill_ratio)
    sc = target / max(sil.size)
    nw, nh = max(1, round(sil.width * sc)), max(1, round(sil.height * sc))
    sil = sil.resize((nw, nh), Image.LANCZOS)
    layer = Image.new("RGBA", (nw, nh), fill + (0,))
    layer.putalpha(sil.getchannel("A"))
    ox = (side - nw) // 2
    oy = (side - nh) // 2 + int(side * 0.035)
    canvas.alpha_composite(layer, (ox, oy))


def badge_symbol_only(im: Image.Image) -> Image.Image:
    """母版角标 → 仅墨色符号（去掉白圆、光晕、抗锯齿灰边）。"""
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    bright = ImageChops.lighter(r, ImageChops.lighter(g, b))
    sym = ImageChops.multiply(a, bright.point(lambda v: 255 if v < 210 else 0))
    if sym.getextrema()[1] < 32:
        sym = ImageChops.multiply(a, bright.point(lambda v: 255 if v < 235 else 0))
    bbox = sym.point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        sym = a.point(lambda v: 255 if v > 10 else 0)
        bbox = sym.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    crop = im.crop(bbox)
    sym = sym.crop(bbox)
    out = Image.new("RGBA", crop.size, INK + (0,))
    out.putalpha(sym)
    return out


def silhouette_stamp(im: Image.Image) -> Image.Image:
    return badge_symbol_only(im)


def clean_gen_badge(im: Image.Image) -> Image.Image:
    """生图角标去灰底噪点，只保留墨色符号。"""
    gray = im.convert("RGBA").convert("L")
    a = gray.point(lambda v: 255 if v < 175 else 0)
    out = Image.new("RGBA", im.size, INK + (0,))
    out.putalpha(a)
    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def _glyph_canvas(n: int):
    m = Image.new("L", (n, n), 0)
    return m, ImageDraw.Draw(m)


def _glyph_git(n: int) -> Image.Image:
    m, d = _glyph_canvas(n)
    w, r = n * 0.15, n * 0.15
    a, b, c = (n * 0.28, n * 0.18), (n * 0.28, n * 0.82), (n * 0.72, n * 0.30)
    d.line([a, b], fill=255, width=round(w))
    d.line([c, (c[0], n * 0.46), (n * 0.28, n * 0.66)], fill=255, width=round(w), joint="curve")
    for x, y in (a, b, c):
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return m


def _glyph_tools(n: int) -> Image.Image:
    m, d = _glyph_canvas(n)
    d.line([(n * 0.20, n * 0.80), (n * 0.55, n * 0.45)], fill=255, width=round(n * 0.21))
    r = n * 0.105
    d.ellipse((n * 0.20 - r, n * 0.80 - r, n * 0.20 + r, n * 0.80 + r), fill=255)
    hx, hy, hr = n * 0.64, n * 0.36, n * 0.29
    d.ellipse((hx - hr, hy - hr, hx + hr, hy + hr), fill=255)
    cx, cy, cr = n * 0.81, n * 0.19, n * 0.17
    d.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=0)
    return m


def _glyph_gametime(n: int) -> Image.Image:
    m, d = _glyph_canvas(n)
    d.rounded_rectangle((n * 0.06, n * 0.26, n * 0.94, n * 0.68), radius=n * 0.2, fill=255)
    d.ellipse((n * 0.06, n * 0.40, n * 0.40, n * 0.84), fill=255)
    d.ellipse((n * 0.60, n * 0.40, n * 0.94, n * 0.84), fill=255)
    px, py, arm, th = n * 0.29, n * 0.47, n * 0.10, n * 0.045
    d.rectangle((px - arm, py - th, px + arm, py + th), fill=0)
    d.rectangle((px - th, py - arm, px + th, py + arm), fill=0)
    br = n * 0.05
    for bx, by in ((n * 0.66, n * 0.43), (n * 0.76, n * 0.53)):
        d.ellipse((bx - br, by - br, bx + br, by + br), fill=0)
    return m


GLYPHS = {"otter-git": _glyph_git, "otter-tools": _glyph_tools, "otter-gametime": _glyph_gametime}


def vector_badge(app: str, size: int = 512) -> Image.Image:
    """矢量画的角标符号（无圆底），4 倍超采样后缩回。"""
    mask = GLYPHS[app](size * 4).resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), INK + (0,))
    out.putalpha(mask)
    bbox = mask.point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def load_badge(app: str, extracted: Image.Image) -> Image.Image:
    if app in GLYPHS and os.environ.get("BRAND_USE_GEN_BADGE") != "1":
        return vector_badge(app)
    """默认用母版抠出的角标剪影；设 BRAND_USE_GEN_BADGE=1 才改用 master/badge_<app>.png。"""
    if os.environ.get("BRAND_USE_GEN_BADGE") == "1":
        custom = f"{MASTER}/badge_{app}.png"
        if os.path.isfile(custom):
            im = clean_gen_badge(Image.open(custom))
            bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
            if bbox:
                return square(im.crop(bbox), 0.04)
    return silhouette_stamp(extracted)


def _place_badge(
    canvas: Image.Image,
    badge_layer: Image.Image,
    side: int,
    app: str | None = None,
    fill: tuple[int, int, int] | None = None,
) -> None:
    bb = badge_layer.convert("RGBA")
    bbox = bb.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return
    bb = bb.crop(bbox)
    if fill is not None:
        tinted = Image.new("RGBA", bb.size, fill + (0,))
        tinted.putalpha(bb.getchannel("A"))
        bb = tinted
    cfg = ICON_BADGE.get(app or "otter-git", ICON_BADGE["otter-git"])
    target = int(side * cfg["scale"])
    sc = target / max(bb.size)
    nw, nh = max(1, round(bb.width * sc)), max(1, round(bb.height * sc))
    bb = bb.resize((nw, nh), Image.LANCZOS)
    ax, ay = cfg["anchor"]
    cx, cy = int(side * ax), int(side * ay)
    canvas.alpha_composite(bb, (cx - nw // 2, cy - nh // 2))


def compose_app_icon(
    silhouette: Image.Image,
    badge_layer: Image.Image,
    colors: tuple[tuple[int, int, int], tuple[int, int, int]],
    side: int = 1024,
    app: str | None = None,
) -> Image.Image:
    """无圆盘：渐变色 = 图标底，白色剪影居中，右上角白色符号角标。"""
    edge, center = colors
    canvas = gradient_background(side, edge, center)
    _place_silhouette(canvas, silhouette, side, fill=ICON_GLYPH)
    _place_badge(canvas, badge_layer, side, app, fill=ICON_GLYPH)
    return rounded(canvas, side * RADIUS)


def product_mark(silhouette: Image.Image, badge_layer: Image.Image, side: int = 512, app: str | None = None) -> Image.Image:
    """透明底产品标：白色剪影 + 角标（色底由 App / 自适应图标绘制）。"""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_silhouette(canvas, silhouette, side, fill_ratio=0.8, fill=ICON_GLYPH)
    _place_badge(canvas, badge_layer, side, app, fill=ICON_GLYPH)
    return canvas


def logo_silhouette_layer(silhouette: Image.Image, side: int = 512) -> Image.Image:
    """通用 logo 层：墨色剪影（浅底/文档用）。"""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_silhouette(canvas, silhouette, side, fill_ratio=0.8, fill=INK)
    return canvas


def logo_badge_plate(badge_layer: Image.Image, side: int = 512, app: str | None = None) -> Image.Image:
    """角标板：墨色（浅底用）。"""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_badge(canvas, badge_layer, side, app, fill=INK)
    return canvas


def template_rgb(im: Image.Image) -> Image.Image:
    """菜单栏 / 托盘用的单色模板图（形状来自 alpha）。"""
    im = im.convert("RGBA")
    a = im.getchannel("A")
    bbox = a.point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return im
    crop = im.crop(bbox)
    out = Image.new("RGBA", crop.size, (0, 0, 0, 255))
    out.putalpha(crop.getchannel("A"))
    return out


def status_bar_glyph(badge: Image.Image, px: int) -> Image.Image:
    """菜单栏 18pt：只保留角标符号，略加粗笔画，居中留白 10%。"""
    im = template_rgb(badge)
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return Image.new("RGBA", (px, px), (0, 0, 0, 0))
    crop = im.crop(bbox)
    a = crop.getchannel("A").filter(ImageFilter.MaxFilter(3))
    bold = Image.new("RGBA", crop.size, INK + (0,))
    bold.putalpha(a)
    pad = max(2, round(px * 0.14))
    inner = px - 2 * pad
    cw, ch = bold.size
    sc = min(inner / cw, inner / ch)
    nw, nh = max(1, round(cw * sc)), max(1, round(ch * sc))
    small = bold.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((px - nw) // 2, (px - nh) // 2))
    return canvas


def fit_template(im: Image.Image, px: int) -> Image.Image:
    return status_bar_glyph(im, px)


def desktop(app: str, hero: Image.Image, badge_layer: Image.Image, tray_rgb: tuple[int, int, int]) -> None:
    base = f"{BRAND}/platform/{app}"
    icons = f"{base}/macos/AppIcon.appiconset"
    big = hero
    for n in (16, 32, 64, 128, 256, 512, 1024):
        write(big, f"{icons}/app_icon_{n}.png", n)
    write_json({
        "images": [
            {"size": f"{pt}x{pt}", "idiom": "mac", "filename": f"app_icon_{pt * sc}.png", "scale": f"{sc}x"}
            for pt in (16, 32, 128, 256, 512) for sc in (1, 2)
        ],
        "info": {"version": 1, "author": "xcode"},
    }, f"{icons}/Contents.json")

    # 菜单栏 / 托盘：角标剪影专用（18pt 加粗），与 Dock 图标水獭区分。
    # Windows 托盘不做模板着色，墨色在深色任务栏上看不见，改用品牌主色。
    status_tpl = status_bar_glyph(badge_layer, 256)
    tray = Image.new("RGBA", status_tpl.size, tray_rgb + (0,))
    tray.putalpha(status_tpl.getchannel("A"))
    menubar = f"{base}/macos/MenuBarIcon.imageset"
    for sc in (1, 2):
        write(status_bar_glyph(badge_layer, 18 * sc), f"{menubar}/menubar_{18 * sc}.png")
    write_json({
        "images": [{"idiom": "mac", "filename": f"menubar_{18 * sc}.png", "scale": f"{sc}x"} for sc in (1, 2)],
        "info": {"version": 1, "author": "xcode"},
        "properties": {"template-rendering-intent": "template"},
    }, f"{menubar}/Contents.json")

    os.makedirs(f"{base}/windows", exist_ok=True)
    hero.resize((256, 256), Image.LANCZOS).save(
        f"{base}/windows/app_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
    tray.save(
        f"{base}/windows/tray_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64)])


IOS_ICONS = [
    ("iphone", 20, (2, 3)), ("iphone", 29, (1, 2, 3)), ("iphone", 40, (2, 3)), ("iphone", 57, (1, 2)),
    ("iphone", 60, (2, 3)), ("ipad", 20, (1, 2)), ("ipad", 29, (1, 2)), ("ipad", 40, (1, 2)),
    ("ipad", 50, (1, 2)), ("ipad", 72, (1, 2)), ("ipad", 76, (1, 2)), ("ipad", 83.5, (2,)),
    ("ios-marketing", 1024, (1,)),
]
ANDROID_DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def mobile(app: str, hero: Image.Image, mark: Image.Image, edge_rgb: tuple[int, int, int]) -> None:
    # 圆角母版进各尺寸；Marketing 1024 必须不透明。
    base = f"{BRAND}/platform/{app}"
    hero_r = ensure_rounded(hero)
    mark_r = ensure_rounded(mark)
    ios_store = flatten_opaque(hero_r, edge_rgb)
    icons = f"{base}/ios/AppIcon.appiconset"
    images = []
    for idiom, pt, scales in IOS_ICONS:
        label = f"{pt:g}x{pt:g}"
        for sc in scales:
            name = f"Icon-App-{label}@{sc}x.png"
            px = round(pt * sc)
            src = ios_store if idiom == "ios-marketing" else hero_r
            write(src, f"{icons}/{name}", px)
            images.append({"size": label, "idiom": idiom, "filename": name, "scale": f"{sc}x"})
    write_json({"images": images, "info": {"version": 1, "author": "xcode"}}, f"{icons}/Contents.json")

    res = f"{base}/android/res"
    for name, k in ANDROID_DENSITY.items():
        write(hero_r, f"{res}/mipmap-{name}/ic_launcher.png", round(48 * k))
        # adaptive foreground：整幅圆角图，系统再套遮罩
        write(mark_r, f"{res}/drawable-{name}/ic_launcher_foreground.png", round(108 * k))
    os.makedirs(f"{res}/mipmap-anydpi-v26", exist_ok=True)
    with open(f"{res}/mipmap-anydpi-v26/ic_launcher.xml", "w") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '  <background android:drawable="@color/ic_launcher_background"/>\n'
            "  <foreground>\n"
            '      <inset\n'
            '          android:drawable="@drawable/ic_launcher_foreground"\n'
            '          android:inset="8%" />\n'
            "  </foreground>\n"
            "</adaptive-icon>\n")
    ground = "#%02X%02X%02X" % edge_rgb
    os.makedirs(f"{res}/values", exist_ok=True)
    with open(f"{res}/values/colors.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{ground}</color>\n</resources>\n')


def require_brand_src(app: str) -> dict[str, str]:
    root = f"{MASTER_BRAND}/{app}"
    paths = {
        "icon": f"{root}/icon.png",
        "dart": f"{root}/dart.png",
        "anim": f"{root}/anim.mp4",
    }
    missing = [k for k, p in paths.items() if not os.path.isfile(p)]
    if missing:
        raise SystemExit(f"缺少 master/brand/{app}/{{{','.join(missing)}}} — 品牌母版 icon+dart+anim 必须齐全")
    return paths


def make_sys(icon: Image.Image, size: tuple[int, int]) -> Image.Image:
    """系统启动垫图：色底 + 居中 icon。比例约 42%，避免桌面/手机上显得过小。"""
    canvas = Image.new("RGB", size, SPLASH_BG)
    side = int(min(size) * 0.42)
    glyph = icon.convert("RGBA").resize((side, side), Image.LANCZOS)
    canvas.paste(glyph, ((size[0] - side) // 2, (size[1] - side) // 2), glyph)
    return canvas


def link_or_copy(src: str, dst: str) -> None:
    """对外树与母版同内容时硬链，避免磁盘双份；跨卷失败则 copy。"""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.lexists(dst):
        os.remove(dst)
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def write_splash(out: str, src: dict[str, str], icon: Image.Image) -> None:
    splash = f"{out}/splash"
    os.makedirs(splash, exist_ok=True)
    link_or_copy(src["dart"], f"{splash}/dart.png")
    link_or_copy(src["anim"], f"{splash}/anim.mp4")
    dart = Image.open(src["dart"]).convert("RGB")
    make_sys(icon, dart.size).save(f"{splash}/sys.png", optimize=True)


def write_avatars() -> None:
    """master/avatars/*.png → media/otter-gametime/avatars/*.webp（对外只留 webp）。"""
    src_dir = f"{MASTER}/avatars"
    dst_dir = f"{BRAND}/media/otter-gametime/avatars"
    if not os.path.isdir(src_dir):
        return
    os.makedirs(dst_dir, exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if not name.endswith(".png") or not name.startswith("avatar_"):
            continue
        im = Image.open(f"{src_dir}/{name}").convert("RGBA")
        out = f"{dst_dir}/{name[:-4]}.webp"
        im.save(out, "WEBP", quality=90, method=6)
    # 清掉对外树残留 png / 旧 roster
    for name in os.listdir(dst_dir):
        if name.endswith(".png") or name == "ROSTER.md":
            os.remove(f"{dst_dir}/{name}")
    print("avatars → media/otter-gametime/avatars/*.webp")


def main() -> None:
    colors = app_colors()
    black = square(Image.open(f"{MASTER}/silhouette.png").convert("RGBA"), 0.02)
    # 白剪影：仅不透明处为白，透明处 RGB 必须为 0，否则方框合成会冒白四角
    white = Image.merge(
        "RGBA",
        (
            Image.new("L", black.size, 255),
            Image.new("L", black.size, 255),
            Image.new("L", black.size, 255),
            black.getchannel("A"),
        ),
    )
    white = clear_transparent_rgb(white)
    black = clear_transparent_rgb(black)
    write(black, f"{BRAND}/common/otter_black.png", 512)
    write(white, f"{BRAND}/common/otter_white.png", 512)
    write(logo_silhouette_layer(black, 512), f"{BRAND}/common/logo_otter.png")

    for app, kind in APPS.items():
        if app not in colors:
            raise SystemExit(f"family.json 缺少 apps.{app}.colors")
        if app not in GLYPHS:
            raise SystemExit(f"缺少矢量角标 GLYPHS[{app}]")
        src = require_brand_src(app)
        out = f"{BRAND}/brand/{app}"
        badge = vector_badge(app)
        hero = Image.open(src["icon"]).convert("RGBA")
        if hero.size != (1024, 1024):
            hero = hero.resize((1024, 1024), Image.LANCZOS)
        # 母版应为圆角；若仍是直角实底则补圆角，再派生各端 icon
        hero = ensure_rounded(hero)
        mark = hero.resize((512, 512), Image.LANCZOS)
        write(mark, f"{out}/icon.png")
        # mark 与 icon 同图：硬链，不双写
        mark_path = f"{out}/mark.png"
        if os.path.lexists(mark_path):
            os.remove(mark_path)
        try:
            os.link(f"{out}/icon.png", mark_path)
        except OSError:
            write(mark, mark_path)
        write(logo_badge_plate(badge, 512, app=app), f"{out}/logo_badge.png", 512)
        write_splash(out, src, hero)
        if kind == "desktop":
            desktop(app, hero, badge, colors[app][0])
        else:
            mobile(app, hero, mark, colors[app][0])
        print(app, "ok ←", f"master/brand/{app}/ → brand/{app}/ + platform/{app}/")

    write_avatars()


if __name__ == "__main__":
    main()
