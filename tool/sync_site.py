#!/usr/bin/env python3
"""把官网静态页同步到官网桶 ottersite（与资源桶 otter/library 分离）。

  python3 tool/sync_site.py          # 上传
  python3 tool/sync_site.py --dry    # 只列将上传的文件
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import sys
from pathlib import Path

import oss2

import oss_store
from paths import family_site

SITE = Path(family_site())
SITE_BUCKET = "ottersite"
SITE_URL = "https://otter.appshaw.cn/"
# 与 .github/workflows/pages.yml 的 WEB 一致
TOPS = ("index.html", "family.json", "shared", "otter-git", "otter-tools", "otter-gametime")
SKIP_NAMES = {".DS_Store", ".git", ".gitignore", "__pycache__"}
SKIP_DIR_PARTS = {"node_modules", "__pycache__", ".git"}


def site_bucket() -> oss2.Bucket:
    c = oss_store._cfg()
    ak = os.environ.get("OSS_AK") or c.get("access_key_id")
    sk = os.environ.get("OSS_SK") or c.get("access_key_secret")
    endpoint = (
        os.environ.get("OSS_ENDPOINT")
        or c.get("endpoint")
        or "oss-cn-beijing.aliyuncs.com"
    )
    if not ak or not sk:
        raise SystemExit("缺少 OSS 凭证：config.json oss.* 或 OSS_AK/OSS_SK")
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    name = os.environ.get("OSS_SITE_BUCKET") or c.get("site_bucket") or SITE_BUCKET
    return oss2.Bucket(oss2.Auth(ak, sk), endpoint, name)


def iter_files() -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    for top in TOPS:
        p = SITE / top
        if not p.exists():
            continue
        if p.is_file():
            out.append((top, p))
            continue
        for f in p.rglob("*"):
            if not f.is_file():
                continue
            if f.name in SKIP_NAMES or f.name.startswith("."):
                continue
            rel = f.relative_to(SITE).as_posix()
            if any(part in SKIP_DIR_PARTS for part in f.relative_to(SITE).parts):
                continue
            out.append((rel, f))
    return out


def content_type(key: str) -> str:
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("image/svg+xml", ".svg")
    mimetypes.add_type("image/webp", ".webp")
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


def cache_for(key: str) -> str:
    if key.endswith((".html", ".json")):
        return "public, max-age=60"
    if key.endswith((".js", ".css")):
        return "public, max-age=600"
    return "public, max-age=86400"


def upload(dry: bool) -> int:
    files = iter_files()
    if dry:
        for key, path in files:
            print(f"{key}\t{path.stat().st_size}")
        print(f"# {len(files)} files → oss://{SITE_BUCKET}/")
        return 0

    bkt = site_bucket()
    n = 0
    for key, path in files:
        data = path.read_bytes()
        headers = {
            "Content-Type": content_type(key),
            "x-oss-object-acl": "public-read",
            "Cache-Control": cache_for(key),
        }
        bkt.put_object(key, data, headers=headers)
        n += 1
        print(f"put {key}")
    print(f"# uploaded {n} files → oss://{bkt.bucket_name}/")
    print(f"# site {SITE_URL}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    os.chdir(SITE)
    return upload(args.dry)


if __name__ == "__main__":
    sys.exit(main())
