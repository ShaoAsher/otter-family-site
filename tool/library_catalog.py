#!/usr/bin/env python3
"""生成公共库分类索引 catalog/index.json + LAYOUT.md。

  python3 tool/library_catalog.py
  （lib publish 时也会调用）
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from paths import APPS, PUBLIC_TOPS, library_private, library_public, library_root

LIB = Path(library_root())
PUBLIC = Path(library_public())
PRIVATE = Path(library_private())
SKIP = {".DS_Store", "__pycache__"}
SKIP_DIRS = {
    "__pycache__",
    "master._bak",
    "_keep",
    "_preview_icon_white",
    "_preview_splash",
    "_splash_boards",
    "_refs",
    "_review",
    "qa",
}

# role → 前缀（相对 public 顶栏或 private/）→ acl
RULES: list[tuple[str, str, str]] = [
    ("family.catalog", "catalog/", "public"),
    ("family.mark", "common/", "public"),
    ("family.expr.delivery", "expr/still/270/", "public"),
    ("family.expr.delivery", "expr/still/540/", "public"),
    ("family.expr.delivery", "expr/anim/270/", "public"),
    ("family.expr.delivery", "expr/anim/540/", "public"),
    ("family.expr.manifest", "expr/manifest.json", "public"),
    ("master.brand", "master/brand/", "private"),
    ("master.ip", "master/ip/", "private"),
    ("master.avatars", "master/avatars/", "private"),
    ("master.silhouette", "master/silhouette", "private"),
    ("master.source", "source/", "private"),
    ("master.expr.full", "expr/still/1080/", "private"),
    ("master.expr.full", "expr/anim/1080/", "private"),
    ("master.expr.delivery", "expr/still/270/", "private"),
    ("master.expr.delivery", "expr/still/540/", "private"),
    ("master.expr.delivery", "expr/anim/270/", "private"),
    ("master.expr.delivery", "expr/anim/540/", "private"),
]
for _app in APPS:
    RULES.append((f"app.{_app}", f"{_app}/", "public"))


def classify(rel: str, zone: str) -> tuple[str, str]:
    for role, prefix, acl in RULES:
        if zone == "public" and acl != "public":
            continue
        if zone == "private" and not role.startswith("master"):
            continue
        if rel == prefix.rstrip("/") or rel.startswith(prefix):
            return role, acl if zone == "public" else "private"
    if zone == "private":
        return "master.other", "private"
    return "unknown", "private"


def walk() -> list[dict]:
    out: list[dict] = []
    for top in sorted(PUBLIC_TOPS):
        root = PUBLIC / top
        if not root.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [
                d
                for d in dirnames
                if d not in SKIP and d not in SKIP_DIRS and not os.path.islink(f"{dirpath}/{d}")
            ]
            for name in filenames:
                if name in SKIP or name.startswith("."):
                    continue
                path = Path(dirpath) / name
                if path.is_symlink():
                    continue
                under = path.relative_to(root).as_posix()
                rel = f"{top}/{under}"
                role, acl = classify(rel, "public")
                out.append(
                    {
                        "path": rel,
                        "role": role,
                        "acl": acl,
                        "bytes": path.stat().st_size,
                    }
                )
    if PRIVATE.is_dir():
        for dirpath, dirnames, filenames in os.walk(PRIVATE):
            dirnames[:] = [
                d
                for d in dirnames
                if d not in SKIP and d not in SKIP_DIRS and not os.path.islink(f"{dirpath}/{d}")
            ]
            for name in filenames:
                if name in SKIP or name.startswith("."):
                    continue
                path = Path(dirpath) / name
                if path.is_symlink():
                    continue
                rel = path.relative_to(PRIVATE).as_posix()
                role, acl = classify(rel, "private")
                out.append(
                    {
                        "path": f"private/{rel}",
                        "role": role,
                        "acl": acl,
                        "bytes": path.stat().st_size,
                    }
                )
    out.sort(key=lambda x: x["path"])
    return out


LAYOUT = """# 水獭家族公共素材库

本地 `otter-library/` 与 OSS `library/` **同构**（无 `latest/`）。

| 区 | OSS 前缀 | 谁能读 |
|----|----------|--------|
| 公开交付 | `library/{expr,common,catalog,otter-*}/` | App / 官网 / 其它仓直链 |
| 母版 | `library/private/` | 仅发版机 / 凭证拉取 |
| 安装包 | `library/release/{app}/v{ver}/` | 公开下载（只保留当前可下版本） |

## 公开根：公用 + App 优先

| 顶栏 | 说明 |
|------|------|
| `catalog/` | LAYOUT + index.json |
| `common/` | 黑白獭、logo |
| `expr/{still,anim}/{270,540}/` | 交付档（1080 只 private） |
| `{app}/` | icon · splash · shots · macos/windows/ios/android · games/ai/store… |

`{app}` = `otter-git` | `otter-tools` | `otter-gametime`。

## 母版区（private）

`master/brand/{app}/{icon,dart,anim}` · `master/ip|avatars` · `source/` · `expr/*/1080/`

## 纪律

1. 进包或官网要直链 → 公开顶栏；母版 / 1080 → `private/`。
2. 公用进 `common|expr|catalog`；App 独有一律挂在 `{app}/` 下。
3. `release/` 只留当前 download.version。
4. 发版：`./tool/otter lib publish --bump --keep-none`（重写 catalog）。
5. 完整流程：`otter-site/docs/FAMILY.md`。

机器可读：同目录 `index.json`。
"""


def write() -> Path:
    entries = walk()
    by_role: dict[str, dict] = {}
    for e in entries:
        slot = by_role.setdefault(e["role"], {"count": 0, "bytes": 0, "acl": e["acl"]})
        slot["count"] += 1
        slot["bytes"] += e["bytes"]

    catalog_dir = PUBLIC / "catalog"
    catalog_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "schema": 3,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "root": "library/",
        "public": "library/",
        "private": "library/private/",
        "roles": by_role,
        "files": entries,
    }
    (catalog_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (catalog_dir / "LAYOUT.md").write_text(LAYOUT, encoding="utf-8")
    print(f"catalog：{len(entries)} 文件 → {catalog_dir}")
    return catalog_dir


if __name__ == "__main__":
    write()
