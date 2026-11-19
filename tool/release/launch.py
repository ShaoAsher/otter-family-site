#!/usr/bin/env python3
"""家族发版一键入口（在家族仓执行 ./tool/otter launch）。

  ./tool/otter launch scan              预检三端 + family.json + 各 App status（不发包）
  ./tool/otter launch sync              library publish（上传品牌/表情等到 OSS library）
  ./tool/otter launch git|tools [--push] [ship 参数…]
  ./tool/otter launch all [--push]      依次 ship 水獭 Git、水獭工具

环境：source ~/.config/devkeys/env.sh；gh auth login。App 目录默认与本仓并列：../otter-<id>，可用 OTTER_APPS 覆盖。

命名约定见 tool/RELEASE.md。
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "family.json"
RELEASE_PY = ROOT / "tool/release/release.py"
SHIP_PY = ROOT / "tool/release/ship.py"
SYNC_BRAND = ROOT / "tool/sync_tos.py"

DEFAULT_APP_ROOTS = {
    "otter-git": "otter-git",
    "otter-tools": "otter-tools",
    "gametime": "otter-gametime/app",
}


def run(*cmd, cwd: Path | None = None, check: bool = True):
    print("==> " + " ".join(map(str, cmd)))
    return subprocess.run([str(c) for c in cmd], cwd=cwd, check=check)


def app_root(app: str) -> Path:
    env = os.environ.get("OTTER_APPS")
    if env:
        mapping = {}
        for part in env.split(":"):
            k, _, v = part.partition("=")
            mapping[k.strip()] = Path(v.strip()).expanduser()
        if app in mapping:
            return mapping[app].resolve()
    base = ROOT.parent
    rel = DEFAULT_APP_ROOTS.get(app)
    if not rel:
        sys.exit(f"未知 App：{app}，可选 git / tools / gametime")
    p = (base / rel).resolve()
    if not (p / "otter.json").is_file():
        sys.exit(f"找不到 App 根目录（需要 otter.json）：{p}")
    return p


def version_of(root: Path) -> str:
    m = re.search(r"^version:\s*([0-9.]+)", (root / "pubspec.yaml").read_text(), re.M)
    return m.group(1) if m else "?"


def preflight_app(app: str, root: Path) -> list[str]:
    issues: list[str] = []
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    meta = cfg["apps"].get(app) or {}
    ver = version_of(root)
    log = (meta.get("changelog") or [{}])[0]
    if log.get("version") != ver:
        issues.append(f"family.json changelog 首条不是 {ver}")
    if not meta.get("download"):
        issues.append("family.json 无 download（仅移动端可跳过 ship）")
    elif meta["download"].get("version") == ver:
        issues.append(f"download.version 已是 {ver}（可能已发过版）")
    r = subprocess.run(["git", "status", "--porcelain"], cwd=root, capture_output=True, text=True)
    if r.stdout.strip():
        issues.append("工作区有未提交改动")
    br = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=root, capture_output=True, text=True)
    if br.stdout.strip() != "main" and os.environ.get("OTTER_RELEASE_ANY_BRANCH") != "1":
        issues.append(f"不在 main 分支（当前 {br.stdout.strip()}）")
    tag = f"v{ver}"
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip()
    tag_sha = subprocess.run(
        ["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}^{{commit}}"],
        cwd=root, capture_output=True, text=True,
    ).stdout.strip()
    if tag_sha and tag_sha != head and os.environ.get("OTTER_RELEASE_ANY_BRANCH") != "1":
        issues.append(f"标签 {tag} 不在当前提交（可 OTTER_RELEASE_ANY_BRANCH=1 或 git tag -f {tag}）")
    return issues


def scan():
    print("=== 家族发版预检 ===\n")
    sys.path.insert(0, str(ROOT / "tool"))
    try:
        import oss_store

        oss_store.bucket()
    except Exception as e:
        print(f"⚠ OSS 不可用：{e}")
    if subprocess.run(["gh", "auth", "status", "-h", "github.com"], capture_output=True).returncode:
        print("⚠ gh 未登录")
    for app in ("otter-git", "otter-tools"):
        root = app_root(app)
        print(f"— {app} ({root.name}) v{version_of(root)} —")
        for line in preflight_app(app, root):
            print(f"  ✗ {line}")
        if not preflight_app(app, root):
            print("  ✓ 预检通过")
    run(sys.executable, RELEASE_PY, "status", cwd=ROOT)


def sync_brand():
    run(sys.executable, SYNC_BRAND, "library", "publish", cwd=ROOT)


def ship_one(app: str, flags: list[str]):
    root = app_root(app)
    issues = preflight_app(app, root)
    for line in issues:
        print(f"预检：{line}")
    if any("无 download" in x for x in issues):
        return
    push_main = "--no-push-main" not in flags and "--no-push-release" not in flags
    ship_flags = [f for f in flags if f not in {"--no-push-main", "--no-push-release"}]
    if push_main:
        ahead = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            cwd=root, capture_output=True, text=True,
        )
        if ahead.stdout.strip() not in ("", "0"):
            run("git", "push", "origin", "main", cwd=root)
    run(sys.executable, SHIP_PY, str(root), *ship_flags, cwd=ROOT)


def main(argv: list[str]):
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd = argv[0]
    rest = argv[1:]
    if cmd == "scan":
        scan()
    elif cmd == "sync":
        sync_brand()
    elif cmd in ("otter-git", "otter-tools"):
        ship_one(cmd, rest)
        run(sys.executable, RELEASE_PY, "status", cmd, cwd=ROOT)
    elif cmd == "all":
        for app in ("otter-git", "otter-tools"):
            ship_one(app, rest)
        run(sys.executable, RELEASE_PY, "status", cwd=ROOT)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])