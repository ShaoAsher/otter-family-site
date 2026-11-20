#!/usr/bin/env python3
"""从 otter-library（优先）或 OSS 公开区 library/latest 拉 App 运行时素材。

  ./tool/otter assets [pull]
  ./tool/otter assets pull bundle   # brand + still/270
  ./tool/otter assets pull brand
  ./tool/otter assets pull expr [bundle]
  ./tool/otter assets check
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(os.environ.get("OTTER_CACHE") or Path.home() / ".cache" / "otter-family")

BRAND_MAP = {
    "otter-git": [
        ("otter-git/icon.png", "assets/brand/otter_git_icon.png"),
        ("otter-git/mark.png", "assets/brand/otter_git_mark.png"),
        ("otter-git/splash/sys.png", "assets/brand/splash/sys.png"),
        ("otter-git/splash/dart.png", "assets/brand/splash/dart.png"),
        ("common/otter_black.png", "assets/brand/otter_black.png"),
        ("common/otter_white.png", "assets/brand/otter_white.png"),
        ("otter-git/windows/app_icon.ico", "windows/runner/resources/app_icon.ico"),
        ("otter-git/windows/tray_icon.ico", "assets/tray/tray_icon.ico"),
    ],
    "otter-tools": [
        ("otter-tools/icon.png", "assets/brand/tools_icon.png"),
        ("otter-tools/logo_badge.png", "assets/brand/tools_badge.png"),
        ("otter-tools/splash/sys.png", "assets/brand/splash/sys.png"),
        ("otter-tools/splash/dart.png", "assets/brand/splash/dart.png"),
        ("common/logo_otter.png", "assets/brand/tools_otter.png"),
        ("common/otter_black.png", "assets/brand/otter_black.png"),
        ("common/otter_white.png", "assets/brand/otter_white.png"),
        ("otter-tools/windows/app_icon.ico", "windows/runner/resources/app_icon.ico"),
    ],
    "otter-gametime": [
        ("otter-gametime/icon.png", "assets/brand/gt_icon.png"),
        ("otter-gametime/logo_badge.png", "assets/brand/gt_badge.png"),
        ("otter-gametime/splash/sys.png", "assets/brand/splash/sys.png"),
        ("otter-gametime/splash/dart.png", "assets/brand/splash/dart.png"),
        # 母版 icon；Android12 启动图由 fit_native_splash 缩成带透明边距的 splash_icon.png
        ("otter-gametime/icon.png", "tool/brand/icon_src.png"),
        ("common/logo_otter.png", "assets/brand/gt_logo_otter.png"),
        ("common/otter_white.png", "assets/brand/gt_otter_w.png"),
        ("common/otter_black.png", "assets/brand/gt_otter_k.png"),
    ],
}

BRAND_TREES = {
    "otter-git": [
        ("otter-git/macos/AppIcon.appiconset", "macos/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("otter-git/macos/MenuBarIcon.imageset", "macos/Runner/Assets.xcassets/MenuBarIcon.imageset"),
    ],
    "otter-tools": [
        ("otter-tools/macos/AppIcon.appiconset", "macos/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("otter-tools/macos/MenuBarIcon.imageset", "macos/Runner/Assets.xcassets/MenuBarIcon.imageset"),
    ],
    "otter-gametime": [
        ("otter-gametime/ios/AppIcon.appiconset", "ios/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("otter-gametime/android/res", "android/app/src/main/res"),
    ],
}


def local_library() -> Path | None:
    env = os.environ.get("OTTER_LIBRARY")
    candidates = [Path(env)] if env else []
    candidates.append(ROOT.parent / "otter-library")
    for p in candidates:
        if (p / "common").is_dir() or (p / "expr").is_dir() or (p / "master").is_dir():
            return p
    return None


def family() -> dict:
    return json.loads((ROOT / "family.json").read_text(encoding="utf-8"))["family"]


def expand(tpl: str, version: str, app: str | None = None) -> str:
    out = tpl.replace("{version}", version)
    if app is not None:
        out = out.replace("{app}", app)
    return out


def library_base(fam: dict | None = None) -> str:
    fam = fam or family()
    base = fam.get("library") or f"{fam['assets']}library/latest/"
    # {version} = libraryVersion（与 App 同号）；不用 libraryBuild 拼路径（走 latest/）
    if "{version}" in base:
        base = expand(base, fam.get("libraryVersion") or "1.0.0")
    return base if base.endswith("/") else base + "/"


def fetch(url: str) -> bytes:
    for i in range(5):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return r.read()
        except OSError:
            if i == 4:
                raise
            import time
            time.sleep(3 * (i + 1))


def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path, expect_md5: str | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cache = CACHE / "library" / hashlib.sha1(url.encode()).hexdigest()[:16]
    cache.parent.mkdir(parents=True, exist_ok=True)
    if expect_md5 and cache.is_file() and md5(cache) == expect_md5:
        shutil.copyfile(cache, dest)
        return
    data = fetch(url)
    if expect_md5 and hashlib.md5(data).hexdigest() != expect_md5:
        raise SystemExit(f"下载校验失败：{url}")
    tmp = cache.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(cache)
    shutil.copyfile(cache, dest)


def expr(app_root: Path, pull: bool, bundle: bool = False) -> bool:
    fam = family()
    cfg = json.loads((app_root / "otter.json").read_text(encoding="utf-8"))["expr"]
    dest = app_root / cfg["dir"]
    local = local_library()
    # App 运行时只用 270；库内仍保留 1080/540/270 三档
    prefixes = ["still/270/"] if bundle else ["still/270/", "anim/270/"]
    label = f"表情 → {cfg['dir']}" + ("（瘦包 still/270）" if bundle else "（still+anim /270）")

    wanted: dict[str, dict] = {}
    if local and (local / "expr").is_dir():
        for pref in prefixes:
            root = local / "expr" / pref.rstrip("/")
            if not root.is_dir():
                continue
            for f in root.glob("*.webp"):
                rel = f"{pref}{f.name}"
                wanted[rel] = {"md5": md5(f), "src": f}
    else:
        remote = fam.get("expr") or f"{library_base(fam)}expr/"
        if not remote.endswith("/"):
            remote += "/"
        man = json.loads(fetch(remote + "manifest.json"))
        files = man.get("files") or {}
        for k, meta in files.items():
            if any(k.startswith(p) for p in prefixes):
                wanted[k] = meta

    wrong = [
        n
        for n, m in wanted.items()
        if not (dest / n).is_file() or (m.get("md5") and md5(dest / n) != m["md5"])
    ]
    extra = []
    if dest.is_dir():
        for p in dest.rglob("*.webp"):
            rel = p.relative_to(dest).as_posix()
            if rel not in wanted:
                extra.append(rel)

    if not pull:
        if wrong or extra:
            print(f"{label}：缺或不一致 {len(wrong)}，多余 {len(extra)}；先 assets pull", file=sys.stderr)
            return False
        print(f"{label}：{len(wanted)} 一致")
        return True

    def get(name):
        meta = wanted[name]
        out = dest / name
        if "src" in meta:
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(meta["src"], out)
            return
        remote = fam.get("expr") or f"{library_base(fam)}expr/"
        if not remote.endswith("/"):
            remote += "/"
        download_file(remote + name, out, meta.get("md5"))

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, wrong))
    for name in extra:
        (dest / name).unlink(missing_ok=True)
    # 清掉旧 still_270 / anim_270 目录
    for legacy in ("still_270", "anim_270", "still_540", "anim_540", "still_1080", "anim_1080"):
        p = dest / legacy
        if p.is_dir():
            shutil.rmtree(p)
    print(f"{label}：更新 {len(wrong)}，删多余 {len(extra)}，共 {len(wanted)}")
    return True


def brand(app_root: Path, pull: bool) -> bool:
    cfg = json.loads((app_root / "otter.json").read_text(encoding="utf-8"))
    app_id = cfg["id"]
    fam = family()
    brand_base = fam.get("brand") or library_base(fam)
    if not brand_base.endswith("/"):
        brand_base += "/"
    local = local_library()
    local_brand = local
    label = f"品牌 → {app_root.name}"

    missing = []
    for src, dst in BRAND_MAP.get(app_id, []):
        if not (app_root / dst).is_file():
            missing.append(src)
    for src_dir, dst_dir in BRAND_TREES.get(app_id, []):
        dest = app_root / dst_dir
        if not dest.is_dir() or not any(dest.rglob("*")):
            missing.append(src_dir)

    if not pull:
        if missing:
            print(f"{label}：缺 {len(missing)}；先 assets pull brand", file=sys.stderr)
            return False
        print(f"{label}：齐全")
        return True

    for src, dst in BRAND_MAP.get(app_id, []):
        dest = app_root / dst
        src_local = local_brand / src if local_brand else None
        if src_local and src_local.is_file():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src_local, dest)
            continue
        try:
            download_file(brand_base + src, dest)
        except Exception as e:
            print(f"  跳过 {src}：{e}", file=sys.stderr)

    for src_dir, dst_dir in BRAND_TREES.get(app_id, []):
        dest_root = app_root / dst_dir
        src_local = local_brand / src_dir if local_brand else None
        if src_local and src_local.is_dir():
            # 合并覆盖：勿 rmtree。游时 android/res 还含 flutter_native_splash 生成的
            # launch_background / styles，整树替换会冲掉系统启动图。
            _merge_tree(src_local, dest_root)
            print(f"  树 {src_dir} ← 本地")
            continue
        print(f"  ⚠ 缺树 {src_dir}", file=sys.stderr)

    print(f"{label}：已更新")
    return True


def _merge_tree(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for path in src.rglob("*"):
        if not path.is_file() or path.name == ".DS_Store":
            continue
        out = dest / path.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, out)


def main(argv: list[str]):
    args = [a for a in argv if not a.startswith("-")]
    pull = True
    if args and args[0] == "check":
        pull = False
        args = args[1:]
    elif args and args[0] == "pull":
        args = args[1:]

    app_root = Path.cwd()
    if args and Path(args[-1]).is_dir() and (Path(args[-1]) / "otter.json").is_file():
        app_root = Path(args[-1])
        args = args[:-1]

    mode = args[0] if args else "all"
    bundle = "bundle" in args
    ok = True
    if mode in ("all", "brand"):
        ok = brand(app_root, pull) and ok
    if mode in ("all", "expr"):
        ok = expr(app_root, pull, bundle=bundle or mode == "all" and "bundle" in argv) and ok
    if mode == "bundle":
        ok = brand(app_root, pull) and expr(app_root, pull, bundle=True) and ok
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main(sys.argv[1:])
