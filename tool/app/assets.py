#!/usr/bin/env python3
"""按 otter.json + family.libraryVersion 从 TOS library 拉取 App 运行时素材。

  ./tool/otter assets [pull]              # expr 全量 + brand（开发）
  ./tool/otter assets pull bundle         # brand + 仅 still 表情（发版瘦包）
  ./tool/otter assets pull brand          # 只拉品牌/平台图标
  ./tool/otter assets pull expr [bundle]  # 只拉表情
  ./tool/otter assets check               # 校验，不一致退出 1

真相源：TOS library/v{family.libraryVersion}/
  brand/<app>/**、brand/common/** → App assets/brand + 平台套件
  expr/{still_270,anim_270} → assets/otter/expr（gitignore）

改素材必须先 library publish，再在此 pull；禁止手改 App 仓里的品牌二进制当源。
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

# app id → 从 library brand 拷到本仓的映射
BRAND_MAP = {
    "git": [
        ("git/icon.png", "assets/brand/otter_git_icon.png"),
        ("git/mark.png", "assets/brand/otter_git_mark.png"),
        ("common/otter_black.png", "assets/brand/otter_black.png"),
        ("common/otter_white.png", "assets/brand/otter_white.png"),
        ("git/windows/app_icon.ico", "windows/runner/resources/app_icon.ico"),
        ("git/windows/tray_icon.ico", "assets/tray/tray_icon.ico"),
    ],
    "tools": [
        ("tools/icon.png", "assets/brand/tools_icon.png"),
        ("tools/logo_badge.png", "assets/brand/tools_badge.png"),
        ("common/logo_otter.png", "assets/brand/tools_otter.png"),
        ("common/otter_black.png", "assets/brand/otter_black.png"),
        ("common/otter_white.png", "assets/brand/otter_white.png"),
        ("tools/windows/app_icon.ico", "windows/runner/resources/app_icon.ico"),
    ],
    "gametime": [
        ("gametime/icon.png", "assets/brand/gt_icon.png"),
        ("gametime/logo_badge.png", "assets/brand/gt_badge.png"),
        ("common/logo_otter.png", "assets/brand/gt_logo_otter.png"),
        ("common/otter_white.png", "assets/brand/gt_otter_w.png"),
        ("common/otter_black.png", "assets/brand/gt_otter_k.png"),
    ],
}

BRAND_TREES = {
    "git": [
        ("git/macos/AppIcon.appiconset", "macos/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("git/macos/MenuBarIcon.imageset", "macos/Runner/Assets.xcassets/MenuBarIcon.imageset"),
    ],
    "tools": [
        ("tools/macos/AppIcon.appiconset", "macos/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("tools/macos/MenuBarIcon.imageset", "macos/Runner/Assets.xcassets/MenuBarIcon.imageset"),
    ],
    "gametime": [
        ("gametime/ios/AppIcon.appiconset", "ios/Runner/Assets.xcassets/AppIcon.appiconset"),
        ("gametime/android/res", "android/app/src/main/res"),
    ],
}


def family() -> dict:
    return json.loads((ROOT / "family.json").read_text(encoding="utf-8"))["family"]


def expand(tpl: str, version: str, app: str | None = None) -> str:
    out = tpl.replace("{version}", version)
    if app is not None:
        out = out.replace("{app}", app)
    return out


def library_base(fam: dict | None = None) -> str:
    """公开最新树 library/current/。"""
    fam = fam or family()
    if "library" in fam:
        base = fam["library"]
        if "{version}" in base:
            base = expand(base, fam.get("libraryVersion") or "1.0.0")
        return base if base.endswith("/") else base + "/"
    return f"{fam['assets']}library/current/"


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
    ver = fam.get("libraryVersion") or cfg.get("version") or "1.0.0"
    # 优先 library；兼容旧 expr/v3
    remote = expand(fam.get("expr") or f"{fam['assets']}library/v{{version}}/expr/", ver)
    if not remote.endswith("/"):
        remote += "/"
    try:
        files = json.loads(fetch(remote + "manifest.json"))["files"]
    except Exception:
        # 回落旧路径
        remote = f"{fam['assets']}expr/{cfg.get('version', 'v3')}/"
        files = json.loads(fetch(remote + "manifest.json"))["files"]
    if bundle:
        wanted = {k: v for k, v in files.items() if k.startswith("still_270/")}
    else:
        wanted = files
    dest = app_root / cfg["dir"]
    wrong = [n for n, m in wanted.items() if not (dest / n).is_file() or md5(dest / n) != m["md5"]]
    extra = (
        sorted(n for n in (p.relative_to(dest).as_posix() for p in dest.rglob("*.webp")) if n not in wanted)
        if dest.is_dir()
        else []
    )
    label = f"表情 library/v{ver} → {cfg['dir']}" + ("（瘦包仅 still）" if bundle else "")
    if not pull:
        if wrong or extra:
            print(f"{label}：缺或不一致 {len(wrong)} 个，多余 {len(extra)} 个；先跑 ./tool/otter assets", file=sys.stderr)
            return False
        print(f"{label}：{len(wanted)} 个，一致")
        return True

    def get(name):
        download_file(remote + name, dest / name, files[name]["md5"])

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, wrong))
    for name in extra:
        (dest / name).unlink(missing_ok=True)
    if bundle:
        anim = dest / "anim_270"
        if anim.is_dir():
            shutil.rmtree(anim)
    print(f"{label}：更新 {len(wrong)} 个，删除多余 {len(extra)} 个，共 {len(wanted)} 个")
    return True


def _list_prefix_via_manifest(brand_base: str, prefix: str) -> list[str]:
    """用 library manifest 列出 brand 下文件；失败则只返回已知单文件。"""
    fam = family()
    lib = library_base(fam)
    try:
        man = json.loads(fetch(lib + "manifest.json"))
        files = man.get("files") or {}
        out = []
        for k in files:
            if k.startswith("brand/" + prefix) or k.startswith(prefix):
                rel = k[6:] if k.startswith("brand/") else k
                if rel.startswith(prefix):
                    out.append(rel)
        return out
    except Exception:
        return []


def brand(app_root: Path, pull: bool) -> bool:
    cfg = json.loads((app_root / "otter.json").read_text(encoding="utf-8"))
    app_id = cfg["id"]
    fam = family()
    ver = fam.get("libraryVersion") or ""
    brand_base = fam.get("brand") or f"{fam['assets']}library/current/brand/"
    if "{version}" in brand_base:
        brand_base = expand(brand_base, ver)
    if not brand_base.endswith("/"):
        brand_base += "/"
    label = f"品牌 library/v{ver}/brand → {app_root.name}"
    missing = []
    # 单文件
    for src, dst in BRAND_MAP.get(app_id, []):
        dest = app_root / dst
        if not dest.is_file():
            missing.append((src, dest))
    # 树：检查 Contents.json 或任意 png
    for src_dir, dst_dir in BRAND_TREES.get(app_id, []):
        dest = app_root / dst_dir
        if not dest.is_dir() or not any(dest.rglob("*")):
            missing.append((src_dir + "/", dest))

    if not pull:
        if missing:
            print(f"{label}：缺 {len(missing)} 项；先跑 ./tool/otter assets pull brand", file=sys.stderr)
            return False
        print(f"{label}：齐全")
        return True

    # 拉单文件
    for src, dst in BRAND_MAP.get(app_id, []):
        dest = app_root / dst
        url = brand_base + src
        try:
            download_file(url, dest)
        except Exception as e:
            print(f"  跳过 {src}：{e}", file=sys.stderr)

    # 拉目录树：优先 manifest 列出的文件
    for src_dir, dst_dir in BRAND_TREES.get(app_id, []):
        dest_root = app_root / dst_dir
        rels = _list_prefix_via_manifest(brand_base, src_dir + "/")
        if not rels:
            # 回落：尝试常见 Contents.json + 尝试从本地 otter_family 拷（若已 library pull）
            local = ROOT / "otter_family" / "library" / "brand" / src_dir
            if local.is_dir():
                if dest_root.exists():
                    shutil.rmtree(dest_root)
                shutil.copytree(local, dest_root)
                print(f"  树 {src_dir} ← 本地 library/brand")
                continue
            print(f"  ⚠ 无法列出 {src_dir}（请先 library pull 或检查 TOS current/）", file=sys.stderr)
            continue
        for rel in rels:
            suffix = rel[len(src_dir) :].lstrip("/")
            download_file(brand_base + rel, dest_root / suffix)
        print(f"  树 {src_dir}：{len(rels)} 个")

    print(f"{label}：已更新")
    return True


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        sys.exit(__doc__)
    action = argv[0]
    if action not in ("pull", "check"):
        sys.exit(__doc__)
    rest = argv[1:]
    bundle = False
    scope = "all"  # all | brand | expr
    app_root = Path(".")
    i = 0
    while i < len(rest):
        a = rest[i]
        if a == "bundle":
            bundle = True
            i += 1
            continue
        if a in ("brand", "expr"):
            scope = a
            i += 1
            continue
        app_root = Path(a).resolve()
        i += 1
        break
    # 剩余可能还有 bundle
    while i < len(rest):
        if rest[i] == "bundle":
            bundle = True
        elif rest[i] in ("brand", "expr"):
            scope = rest[i]
        i += 1

    app_root = app_root.resolve()
    if not (app_root / "otter.json").is_file():
        # 兼容：最后一个参数是 app 根；或 cwd
        if (Path(".") / "otter.json").is_file():
            app_root = Path(".").resolve()
        else:
            sys.exit(f"{app_root} 下没有 otter.json")

    pull = action == "pull"
    ok = True
    if scope in ("all", "brand"):
        ok = brand(app_root, pull) and ok
    if scope in ("all", "expr"):
        ok = expr(app_root, pull, bundle=bundle) and ok
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
