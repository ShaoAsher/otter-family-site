"""阿里云 OSS 读写（公开 library/{expr,common,catalog,otter-*} / release / family，私有 private）。

凭证读 ~/.config/devkeys/config.json 的 oss 段；也可用环境变量
OSS_AK / OSS_SK / OSS_BUCKET / OSS_ENDPOINT / OSS_REGION。
"""
from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path

import oss2

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("video/mp4", ".mp4")

BUCKET_BASE = "https://otter.oss-cn-beijing.aliyuncs.com"
PUBLIC_PREFIXES = (
    "library/expr/",
    "library/common/",
    "library/catalog/",
    "library/otter-git/",
    "library/otter-tools/",
    "library/otter-gametime/",
    "library/release/",
    "library/keep/",
    "library/family.json",
    "library/current.json",
)
PRIVATE_PREFIXES = ("library/private/",)


def _cfg() -> dict:
    path = Path.home() / ".config/devkeys/config.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8")).get("oss") or {}


def bucket() -> oss2.Bucket:
    c = _cfg()
    ak = os.environ.get("OSS_AK") or c.get("access_key_id")
    sk = os.environ.get("OSS_SK") or c.get("access_key_secret")
    name = os.environ.get("OSS_BUCKET") or c.get("bucket") or "otter"
    endpoint = os.environ.get("OSS_ENDPOINT") or c.get("endpoint") or "oss-cn-beijing.aliyuncs.com"
    if not ak or not sk:
        raise SystemExit("缺少 OSS 凭证：config.json oss.* 或 OSS_AK/OSS_SK")
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    return oss2.Bucket(oss2.Auth(ak, sk), endpoint, name)


def content_type(key: str) -> str:
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


def put_bytes(bkt: oss2.Bucket, key: str, data: bytes, *, public: bool, cache: str | None = None):
    headers = {"Content-Type": content_type(key)}
    if public:
        headers["x-oss-object-acl"] = "public-read"
        headers["Cache-Control"] = cache or (
            "no-cache" if key.endswith(".json") else "public, max-age=86400"
        )
    else:
        headers["x-oss-object-acl"] = "private"
    bkt.put_object(key, data, headers=headers)


def put_file(bkt: oss2.Bucket, key: str, path: str, *, public: bool, cache: str | None = None):
    headers = {"Content-Type": content_type(key)}
    if public:
        headers["x-oss-object-acl"] = "public-read"
        headers["Cache-Control"] = cache or "public, max-age=31536000, immutable"
        if key.startswith("library/release/"):
            headers["Content-Disposition"] = f'attachment; filename="{Path(path).name}"'
    else:
        headers["x-oss-object-acl"] = "private"
    bkt.put_object_from_file(key, path, headers=headers)


def has(bkt: oss2.Bucket, key: str) -> bool:
    try:
        bkt.head_object(key)
        return True
    except oss2.exceptions.NoSuchKey:
        return False
    except oss2.exceptions.OssError as e:
        if getattr(e, "status", None) == 404:
            return False
        raise


def list_keys(bkt: oss2.Bucket, prefix: str) -> list[str]:
    return [obj.key for obj in oss2.ObjectIterator(bkt, prefix=prefix) if not obj.key.endswith("/")]


def get_bytes(bkt: oss2.Bucket, key: str) -> bytes:
    return bkt.get_object(key).read()


def delete(bkt: oss2.Bucket, key: str):
    bkt.delete_object(key)
