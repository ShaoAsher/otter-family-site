#!/usr/bin/env python3
"""由 brand/master/ 母版生成三端可直接拷贝的品牌成品（只在母版变了时跑一次，App 侧只拷贝不生成）。

  python3 source/brand_build.py

母版 brand/master/（只改这里）：
  <app>.png          仅从各图扣出徽章图形（mark_and_layers）；图标底 = family.json 品牌渐变色铺满圆角方图，
                     无圆盘描边；剪影居中放大叠在渐变色上
  silhouette.png     透明底水獭剪影
  badge_<app>.png    可选：生图角标剪影（无白圆底）；没有则从母版抠图后压成纯色剪影
  ip_full.png、ip_half.png   立绘（造型参考，不参与生成）

产物（每个文件只有一份，不同用途靠不同规格区分）：
  brand/common/   三端共用
    otter_black.png、otter_white.png   512 剪影（贴边裁切后居中，四周留 4%）
    logo_otter.png                     512 分层 logo 的水獭层（画布 = 圆盘外接正方形，墨色 #0B0A14）
  brand/<app>/
    icon.png         512 圆角图标（22.5%）
    mark.png         512 产品标：抠掉深底，只留圆盘 + 徽章
    logo_badge.png   512 分层 logo 的徽章层（与 logo_otter.png 同画布，徽章已在位）
    桌面端（git / tools）：macos/AppIcon.appiconset/、macos/MenuBarIcon.imageset/（含 Contents.json）、
                         windows/app_icon.ico、windows/tray_icon.ico
    移动端（gametime）：ios/AppIcon.appiconset/（含 Contents.json，无 alpha）、
                       android/res/（mipmap-*/ic_launcher.png、drawable-*/ic_launcher_foreground.png、
                                    mipmap-anydpi-v26/ic_launcher.xml、values/colors.xml）
"""
from __future__ import annotations

import json
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = f"{ROOT}/brand"
MASTER = f"{BRAND}/master"
INK = (11, 10, 20)
APPS = {"git": "desktop", "tools": "desktop", "gametime": "mobile"}

RADIUS = 0.225
# 角标方案（右上、无圆底、墨色符号）：
# - 水獭占中下方，面孔在上半区；角标放右上圆角安全区，避开五官，扫一眼能分 App。
# - 只有分支 / 扳手 / 手柄符号，不要白圆底；相对边长约 13%，中心锚在 (84%, 17%)。
ICON_BADGE = {
    "git": {"scale": 0.215, "anchor": (0.80, 0.195)},
    "tools": {"scale": 0.215, "anchor": (0.80, 0.195)},
    "gametime": {"scale": 0.20, "anchor": (0.80, 0.18)},
}
# 源图方块自带约 12% 圆角，圆角外是白底或深底；四周各裁 4.2% 就全落在方块内。
INSET = 0.042
# 圆盘边缘：圆盘最暗处的最大通道值 > 195，外圈光晕 < 115。
DISC_THRESHOLD = 150


def write(im: Image.Image, path: str, size: int | None = None) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (im.resize((size, size), Image.LANCZOS) if size else im).save(path, optimize=True)


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
    path = os.path.join(ROOT, "..", "family.json")
    data = json.load(open(path, encoding="utf-8"))
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


def _place_silhouette(canvas: Image.Image, silhouette: Image.Image, side: int, fill_ratio: float = 0.84) -> None:
    sil = silhouette.convert("RGBA")
    bbox = sil.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return
    sil = sil.crop(bbox)
    target = int(side * fill_ratio)
    sc = target / max(sil.size)
    nw, nh = max(1, round(sil.width * sc)), max(1, round(sil.height * sc))
    sil = sil.resize((nw, nh), Image.LANCZOS)
    layer = Image.new("RGBA", (nw, nh), INK + (0,))
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


GLYPHS = {"git": _glyph_git, "tools": _glyph_tools, "gametime": _glyph_gametime}


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


def _place_badge(canvas: Image.Image, badge_layer: Image.Image, side: int, app: str | None = None) -> None:
    bb = badge_layer.convert("RGBA")
    bbox = bb.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        return
    bb = bb.crop(bbox)
    cfg = ICON_BADGE.get(app or "git", ICON_BADGE["git"])
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
    """无圆盘：渐变色 = 图标底，水獭剪影居中，右上角墨色符号角标。"""
    edge, center = colors
    canvas = gradient_background(side, edge, center)
    _place_silhouette(canvas, silhouette, side)
    _place_badge(canvas, badge_layer, side, app)
    return rounded(canvas, side * RADIUS)


def product_mark(silhouette: Image.Image, badge_layer: Image.Image, side: int = 512, app: str | None = None) -> Image.Image:
    """透明底产品标：剪影 + 徽章（渐变由 App / 官网代码绘制）。"""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_silhouette(canvas, silhouette, side, fill_ratio=0.8)
    _place_badge(canvas, badge_layer, side, app)
    return canvas


def logo_silhouette_layer(silhouette: Image.Image, side: int = 512) -> Image.Image:
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_silhouette(canvas, silhouette, side, fill_ratio=0.8)
    return canvas


def logo_badge_plate(badge_layer: Image.Image, side: int = 512, app: str | None = None) -> Image.Image:
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    _place_badge(canvas, badge_layer, side, app)
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


def desktop(out: str, hero: Image.Image, badge_layer: Image.Image) -> None:
    icons = f"{out}/macos/AppIcon.appiconset"
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
    status_tpl = status_bar_glyph(badge_layer, 256)
    menubar = f"{out}/macos/MenuBarIcon.imageset"
    for sc in (1, 2):
        write(status_bar_glyph(badge_layer, 18 * sc), f"{menubar}/menubar_{18 * sc}.png")
    write_json({
        "images": [{"idiom": "mac", "filename": f"menubar_{18 * sc}.png", "scale": f"{sc}x"} for sc in (1, 2)],
        "info": {"version": 1, "author": "xcode"},
        "properties": {"template-rendering-intent": "template"},
    }, f"{menubar}/Contents.json")

    os.makedirs(f"{out}/windows", exist_ok=True)
    hero.resize((256, 256), Image.LANCZOS).save(
        f"{out}/windows/app_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
    status_tpl.save(
        f"{out}/windows/tray_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64)])


IOS_ICONS = [
    ("iphone", 20, (2, 3)), ("iphone", 29, (1, 2, 3)), ("iphone", 40, (2, 3)), ("iphone", 57, (1, 2)),
    ("iphone", 60, (2, 3)), ("ipad", 20, (1, 2)), ("ipad", 29, (1, 2)), ("ipad", 40, (1, 2)),
    ("ipad", 50, (1, 2)), ("ipad", 72, (1, 2)), ("ipad", 76, (1, 2)), ("ipad", 83.5, (2,)),
    ("ios-marketing", 1024, (1,)),
]
ANDROID_DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def mobile(out: str, hero: Image.Image, mark: Image.Image, edge_rgb: tuple[int, int, int]) -> None:
    icons = f"{out}/ios/AppIcon.appiconset"
    images = []
    for idiom, pt, scales in IOS_ICONS:
        label = f"{pt:g}x{pt:g}"
        for sc in scales:
            name = f"Icon-App-{label}@{sc}x.png"
            write(hero, f"{icons}/{name}", round(pt * sc))
            images.append({"size": label, "idiom": idiom, "filename": name, "scale": f"{sc}x"})
    write_json({"images": images, "info": {"version": 1, "author": "xcode"}}, f"{icons}/Contents.json")

    res = f"{out}/android/res"
    for name, k in ANDROID_DENSITY.items():
        write(hero, f"{res}/mipmap-{name}/ic_launcher.png", round(48 * k))
        write(mark, f"{res}/drawable-{name}/ic_launcher_foreground.png", round(108 * k))
    os.makedirs(f"{res}/mipmap-anydpi-v26", exist_ok=True)
    with open(f"{res}/mipmap-anydpi-v26/ic_launcher.xml", "w") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '  <background android:drawable="@color/ic_launcher_background"/>\n'
            "  <foreground>\n"
            '      <inset\n'
            '          android:drawable="@drawable/ic_launcher_foreground"\n'
            '          android:inset="16%" />\n'
            "  </foreground>\n"
            "</adaptive-icon>\n")
    ground = "#%02X%02X%02X" % edge_rgb
    os.makedirs(f"{res}/values", exist_ok=True)
    with open(f"{res}/values/colors.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{ground}</color>\n</resources>\n')


def main() -> None:
    colors = app_colors()
    black = square(Image.open(f"{MASTER}/silhouette.png").convert("RGBA"), 0.02)
    white = Image.new("RGBA", black.size, (255, 255, 255, 0))
    white.putalpha(black.getchannel("A"))
    write(black, f"{BRAND}/common/otter_black.png", 512)
    write(white, f"{BRAND}/common/otter_white.png", 512)
    write(logo_silhouette_layer(black, 512), f"{BRAND}/common/logo_otter.png")

    for app, kind in APPS.items():
        if app not in colors:
            raise SystemExit(f"family.json 缺少 apps.{app}.colors")
        out = f"{BRAND}/{app}"
        tile = full_bleed(Image.open(f"{MASTER}/{app}.png"))
        _, _, badge_raw = mark_and_layers(tile)
        badge = load_badge(app, badge_raw)
        hero = compose_app_icon(black, badge, colors[app], 1024, app=app)
        mark = product_mark(black, badge, 512, app=app)
        write(hero.resize((512, 512), Image.LANCZOS), f"{out}/icon.png")
        write(mark, f"{out}/mark.png", 512)
        write(logo_badge_plate(badge, 512, app=app), f"{out}/logo_badge.png", 512)
        if kind == "desktop":
            desktop(out, hero, badge)
        else:
            mobile(out, hero, mark, colors[app][0])
        print(app, "ok")


if __name__ == "__main__":
    main()
