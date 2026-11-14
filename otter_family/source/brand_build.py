#!/usr/bin/env python3
"""由 brand/master/ 母版生成三端可直接拷贝的品牌成品（只在母版变了时跑一次，App 侧只拷贝不生成）。

  python3 source/brand_build.py

母版 brand/master/（只改这里）：
  icon_<app>.png     三端图标母版（深底方块 + 圆盘 + 水獭 + 徽章）。三张共用同一模板：深底、圆盘大小、
                     水獭、光晕、徽章位置与大小完全一致，只换圆盘渐变（配色见 README）与徽章图形
  silhouette.png     透明底水獭剪影
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


def mac_canvas(tile: Image.Image) -> Image.Image:
    body = 824
    face = rounded(tile.resize((body, body), Image.LANCZOS), body * RADIUS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    shadow = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((100, 112, 924, 936), radius=body * RADIUS, fill=90)
    layer = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    layer.putalpha(shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(layer)
    canvas.alpha_composite(face, (100, 100))
    return canvas


def desktop(out: str, tile: Image.Image, mark: Image.Image, black: Image.Image) -> None:
    icons = f"{out}/macos/AppIcon.appiconset"
    big = mac_canvas(tile)
    for n in (16, 32, 64, 128, 256, 512, 1024):
        write(big, f"{icons}/app_icon_{n}.png", n)
    write_json({
        "images": [
            {"size": f"{pt}x{pt}", "idiom": "mac", "filename": f"app_icon_{pt * sc}.png", "scale": f"{sc}x"}
            for pt in (16, 32, 128, 256, 512) for sc in (1, 2)
        ],
        "info": {"version": 1, "author": "xcode"},
    }, f"{icons}/Contents.json")

    menubar = f"{out}/macos/MenuBarIcon.imageset"
    for sc in (1, 2):
        write(black, f"{menubar}/menubar_{18 * sc}.png", 18 * sc)
    write_json({
        "images": [{"idiom": "mac", "filename": f"menubar_{18 * sc}.png", "scale": f"{sc}x"} for sc in (1, 2)],
        "info": {"version": 1, "author": "xcode"},
        "properties": {"template-rendering-intent": "template"},
    }, f"{menubar}/Contents.json")

    os.makedirs(f"{out}/windows", exist_ok=True)
    rounded(tile.resize((256, 256), Image.LANCZOS), 256 * RADIUS).save(
        f"{out}/windows/app_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)])
    mark.resize((256, 256), Image.LANCZOS).save(
        f"{out}/windows/tray_icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64)])


IOS_ICONS = [
    ("iphone", 20, (2, 3)), ("iphone", 29, (1, 2, 3)), ("iphone", 40, (2, 3)), ("iphone", 57, (1, 2)),
    ("iphone", 60, (2, 3)), ("ipad", 20, (1, 2)), ("ipad", 29, (1, 2)), ("ipad", 40, (1, 2)),
    ("ipad", 50, (1, 2)), ("ipad", 72, (1, 2)), ("ipad", 76, (1, 2)), ("ipad", 83.5, (2,)),
    ("ios-marketing", 1024, (1,)),
]
ANDROID_DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def mobile(out: str, tile: Image.Image, mark: Image.Image) -> None:
    icons = f"{out}/ios/AppIcon.appiconset"
    images = []
    for idiom, pt, scales in IOS_ICONS:
        label = f"{pt:g}x{pt:g}"
        for sc in scales:
            name = f"Icon-App-{label}@{sc}x.png"
            write(tile, f"{icons}/{name}", round(pt * sc))
            images.append({"size": label, "idiom": idiom, "filename": name, "scale": f"{sc}x"})
    write_json({"images": images, "info": {"version": 1, "author": "xcode"}}, f"{icons}/Contents.json")

    res = f"{out}/android/res"
    for name, k in ANDROID_DENSITY.items():
        write(tile, f"{res}/mipmap-{name}/ic_launcher.png", round(48 * k))
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
    ground = "#%02X%02X%02X" % tile.getpixel((tile.width // 2, round(tile.height * 0.03)))
    os.makedirs(f"{res}/values", exist_ok=True)
    with open(f"{res}/values/colors.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{ground}</color>\n</resources>\n')


def main() -> None:
    black = square(Image.open(f"{MASTER}/silhouette.png").convert("RGBA"), 0.04)
    white = Image.new("RGBA", black.size, (255, 255, 255, 0))
    white.putalpha(black.getchannel("A"))
    write(black, f"{BRAND}/common/otter_black.png", 512)
    write(white, f"{BRAND}/common/otter_white.png", 512)

    for app, kind in APPS.items():
        out = f"{BRAND}/{app}"
        tile = full_bleed(Image.open(f"{MASTER}/icon_{app}.png"))
        mark, otter_layer, badge_layer = mark_and_layers(tile)
        write(rounded(tile.resize((512, 512), Image.LANCZOS), 512 * RADIUS), f"{out}/icon.png")
        write(mark, f"{out}/mark.png", 512)
        write(badge_layer, f"{out}/logo_badge.png", 512)
        if app == "git":
            write(otter_layer, f"{BRAND}/common/logo_otter.png", 512)
        if kind == "desktop":
            desktop(out, tile, mark, black)
        else:
            mobile(out, tile, mark)
        print(app, "ok")


if __name__ == "__main__":
    main()
