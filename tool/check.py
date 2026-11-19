#!/usr/bin/env python3
"""契约检查：表情清单、路径、kit、发版前置。钥匙数以 tool/expr_keys.md 为准，增删表情后本检查自动跟新数量。

  ./tool/otter check              # 家族仓：清单 + 本地 library
  ./tool/otter check .            # App 根：再查安装包资源与遗留路径
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEYS_MD = ROOT / "tool" / "expr_keys.md"
KIT_STORE = ROOT / "packages" / "otter_kit" / "lib" / "src" / "otter_expr_store.dart"
KIT_FAMILY = ROOT / "packages" / "otter_kit" / "lib" / "src" / "family_config.dart"

LEGACY = ("still_270", "anim_270", "still_540", "anim_540", "expr/v3/")
OK_STILL = "assets/otter/expr/still/270/"
# 默认 270；高清开关为 540（OtterExprStore 用 anim/$size/）
OK_ANIM = ("anim/270/", "anim/$size/")
OK_FAMILY = "library/family.json"


def keys_from_md() -> list[str]:
    text = KEYS_MD.read_text(encoding="utf-8")
    keys = []
    for line in text.splitlines():
        m = re.match(r"^\|\s*([a-z][a-z0-9_]*)\s*\|", line)
        if not m:
            continue
        k = m.group(1)
        if k in ("key", "---"):
            continue
        keys.append(k)
    return keys


def count_webp(dir_path: Path) -> int:
    if not dir_path.is_dir():
        return -1
    return sum(1 for p in dir_path.glob("*.webp") if p.is_file())


def fail(msg: str, errors: list[str]) -> None:
    errors.append(msg)
    print(f"✗ {msg}")


def ok(msg: str) -> None:
    print(f"✓ {msg}")


def check_family(errors: list[str]) -> list[str]:
    if not KEYS_MD.is_file():
        fail(f"缺少 {KEYS_MD}", errors)
        return []
    keys = keys_from_md()
    n = len(keys)
    if n < 1:
        fail("expr_keys.md 未解析到任何 key", errors)
        return []
    ok(f"expr_keys.md → {n} keys")

    # 本地 library（可缺，缺则只警告）
    try:
        sys.path.insert(0, str(ROOT / "tool"))
        from paths import library_root  # type: ignore

        lib = Path(library_root())
    except Exception:
        lib = None
    if lib and lib.is_dir():
        for kind in ("still", "anim"):
            d = lib / "expr" / kind / "270"
            c = count_webp(d)
            if c < 0:
                fail(f"本地 library 缺 {d.relative_to(lib) if d.is_relative_to(lib) else d}", errors)
            elif c != n:
                fail(f"library expr/{kind}/270 有 {c} 张，清单 {n}（先 lib export）", errors)
            else:
                ok(f"library expr/{kind}/270 = {c}")
        src = lib / "source" / "still"
        if src.is_dir():
            jpgs = sum(1 for p in src.glob("*.jpg") if p.is_file())
            if jpgs and jpgs != n:
                fail(f"source/still 有 {jpgs} 张 jpg，清单 {n}", errors)
            elif jpgs:
                ok(f"source/still = {jpgs}")
    else:
        print("· 跳过本地 library（未找到 otter-library）")

    if KIT_STORE.is_file():
        store = KIT_STORE.read_text(encoding="utf-8")
        if OK_STILL not in store:
            fail(f"otter_kit stillAssetPath 未含 {OK_STILL}", errors)
        if not any(p in store for p in OK_ANIM):
            fail(f"otter_kit anim 路径未含 {' 或 '.join(OK_ANIM)}", errors)
        if "library/latest/expr/" not in store:
            fail("otter_kit fallbackBase 应为 library/latest/expr/", errors)
        for bad in ("still_270", "anim_270", "/expr/v3/"):
            if re.search(rf"['\"][^'\"]*{re.escape(bad)}", store):
                fail(f"otter_kit 仍引用遗留路径 {bad}", errors)
        ok("otter_kit OtterExprStore 路径契约")
    else:
        fail(f"缺少 {KIT_STORE}", errors)

    if KIT_FAMILY.is_file():
        fam = KIT_FAMILY.read_text(encoding="utf-8")
        if OK_FAMILY not in fam:
            fail(f"FamilyConfig.remotes 应含 {OK_FAMILY}", errors)
        if "config/family.json" in fam:
            fail("FamilyConfig 仍指向已 404 的 config/family.json", errors)
        ok("FamilyConfig remotes")
    return keys


def check_app(app_root: Path, keys: list[str], errors: list[str]) -> None:
    n = len(keys)
    otter = app_root / "otter.json"
    if not otter.is_file():
        fail(f"{app_root} 不是 App 根（无 otter.json）", errors)
        return
    app_id = __import__("json").loads(otter.read_text(encoding="utf-8")).get("id", "")
    ok(f"App {app_id}")

    still = app_root / "assets" / "otter" / "expr" / "still" / "270"
    anim = app_root / "assets" / "otter" / "expr" / "anim" / "270"
    sc = count_webp(still)
    ac = count_webp(anim)
    # 瘦包：仅 still；全量：still+anim
    if sc < 0:
        fail("缺 assets/otter/expr/still/270（先 ./tool/otter assets pull bundle）", errors)
    elif sc != n:
        fail(f"App still/270 有 {sc} 张，清单 {n}", errors)
    else:
        ok(f"App still/270 = {sc}")
    if ac >= 0 and ac not in (0, n):
        fail(f"App anim/270 有 {ac} 张，应为 0（瘦包）或 {n}", errors)
    elif ac == n:
        ok(f"App anim/270 = {ac}（全量包）")
    elif ac == 0 or ac < 0:
        print("· App 无 anim/270（瘦包 OK，运行时 OSS 公开区拉）")

    # 源码遗留路径（排除 gen、build）
    scan_roots = [app_root / "lib", app_root / "macos", app_root / "windows", app_root / "mockup"]
    pat = re.compile("|".join(re.escape(x) for x in LEGACY))
    hits: list[str] = []
    for root in scan_roots:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix.lower() not in {".dart", ".swift", ".kt", ".html", ".js", ".md", ".json"}:
                continue
            if "assets.gen.dart" in p.name:
                continue
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if pat.search(text):
                # 允许文档里讨论「清掉旧 still_270」
                if "清掉旧" in text or "legacy" in text.lower():
                    continue
                rel = str(p.relative_to(app_root))
                hits.append(rel)
    if hits:
        fail("源码仍含遗留表情路径：\n  - " + "\n  - ".join(hits[:20]), errors)
    else:
        ok("App 源码无 still_270 / anim_270 / expr/v3")

    # pubspec kit ref（若用 git）
    pub = app_root / "pubspec.yaml"
    if pub.is_file():
        yaml = pub.read_text(encoding="utf-8")
        if "otter_kit:" in yaml and "ref:" in yaml:
            m = re.search(r"otter_kit:.*?ref:\s*(\S+)", yaml, re.S)
            if m:
                ok(f"otter_kit ref = {m.group(1)}")
            if "kit-v1.0.2" in yaml or "kit-v1.0.1" in yaml or "kit-v1.0.0" in yaml:
                fail("otter_kit ref 过旧（需 ≥ kit-v1.0.3，含 still/270）", errors)


def main(argv: list[str]) -> int:
    errors: list[str] = []
    print("==> otter check")
    keys = check_family(errors)
    app = None
    if argv:
        app = Path(argv[0]).resolve()
        if app.is_file():
            app = app.parent
        check_app(app, keys or [], errors)
    elif (Path.cwd() / "otter.json").is_file():
        check_app(Path.cwd().resolve(), keys or [], errors)

    if errors:
        print(f"\n失败 {len(errors)} 项。增删表情后请同步：expr_keys.md → lib export → assets pull → kit（若改路径）")
        return 1
    print("\n全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
