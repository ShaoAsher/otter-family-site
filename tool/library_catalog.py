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

from paths import library_latest, library_private, library_root

LIB = Path(library_root())
LATEST = Path(library_latest())
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

# role → 前缀（相对 latest/ 或 private/）→ acl
RULES: list[tuple[str, str, str]] = [
    ("family.catalog", "catalog/", "public"),
    ("family.mark", "common/", "public"),
    ("family.expr.delivery", "expr/still/270/", "public"),
    ("family.expr.delivery", "expr/still/540/", "public"),
    ("family.expr.delivery", "expr/anim/270/", "public"),
    ("family.expr.delivery", "expr/anim/540/", "public"),
    ("family.expr.manifest", "expr/manifest.json", "public"),
    ("family.shots", "shots/", "public"),
    ("public.brand", "brand/", "public"),
    ("public.media", "media/", "public"),
    ("public.badges", "badges/", "public"),
    ("public.platform", "platform/", "public"),
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


def classify(rel: str, zone: str) -> tuple[str, str]:
    for role, prefix, acl in RULES:
        if acl != ("public" if zone == "latest" else "private"):
            # allow private rules only in private zone and vice versa for clarity
            if zone == "latest" and acl != "public":
                continue
            if zone == "private" and not role.startswith("master"):
                continue
        if rel == prefix.rstrip("/") or rel.startswith(prefix):
            return role, acl if zone == "latest" else "private"
    if zone == "private":
        return "master.other", "private"
    return "unknown", "private"


def walk() -> list[dict]:
    out: list[dict] = []
    for zone, root in (("latest", LATEST), ("private", PRIVATE)):
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
                rel = path.relative_to(root).as_posix()
                role, acl = classify(rel, zone)
                out.append(
                    {
                        "path": f"{zone}/{rel}",
                        "role": role,
                        "acl": acl,
                        "bytes": path.stat().st_size,
                    }
                )
    out.sort(key=lambda x: x["path"])
    return out


LAYOUT = """# 水獭家族公共素材库

本地 `otter-library/{latest,private}/` 与 OSS `library/{latest,private}/` **同构**。

唯一根：`library/`（OSS）/ `otter-library/`（本地）

| 区 | OSS 前缀 | 谁能读 |
|----|----------|--------|
| 公开交付 | `library/latest/` | App / 官网 / 其它仓直链 |
| 母版 | `library/private/` | 仅发版机 / 凭证拉取 |
| 安装包 | `library/release/{app}/v{ver}/` | 公开下载（只保留当前可下版本） |

## 公开根：公用 + 按 App

| 顶栏 | 路径 | 说明 |
|------|------|------|
| 索引 | `catalog/` | LAYOUT + index.json |
| 公用标 | `common/` | 黑白獭、logo |
| 公用表情 | `expr/{still,anim}/{270,540}/` | 交付档（1080 只 private） |
| 品牌 | `brand/{app}/` | icon · mark · logo_badge · splash |
| 媒体 | `media/{app}/` | og / promo / scenes / games / ai… |
| 玩法 | `badges/{app}/` | 成就等（公开备份；游时仍打进包） |
| 平台套件 | `platform/{app}/` | 原生图标套件 |
| 截图 | `shots/{app}/` | 商店 / 官网截图 |

`{app}` = `otter-git` | `otter-tools` | `otter-gametime`。游时 games/ai 挂在 `media/otter-gametime/`。

## 母版区（private）

`master/brand/{app}/{icon,dart,anim}` · `master/ip|avatars` · `source/` · `expr/*/1080/`  
禁止 `_splash_boards` / 旧扁平 `library/games|ai|gametime`。

## 纪律

1. 进包或官网要直链 → `latest/`；母版 / 1080 → `private/`。
2. 公用进 `common|expr|catalog`；App 独有一律 `{kind}/{app}/`。
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

    catalog_dir = LATEST / "catalog"
    catalog_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "schema": 2,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "root": "library/",
        "public": "library/latest/",
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
