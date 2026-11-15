#!/usr/bin/env python3
"""TOS library：内容寻址去重 + 版本清单（只上传变更对象，不全量备份）。

本地真相目录（唯一工作副本，gitignore）：
  otter_family/library/{brand,expr,source,site}/

远端：
  library/objects/<sha256[:2]>/<sha256>     # 去重对象库
  library/versions/vX.Y.Z/manifest.json      # 该版完整 path→sha（可 parent 追溯）
  library/current.json                       # { version, … }
  library/current/{brand,expr,site}/         # 公开可读「最新」树（按文件增量覆盖）
  config/family.json

  python3 source/sync_tos.py library publish [--bump] [--notes "…"] [--version X.Y.Z]
  python3 source/sync_tos.py library pull [version]   # 按 manifest 从 objects 还原到 library/
  python3 source/sync_tos.py library cleanup          # 删除旧 brand/、expr/v3/、site/、library/v1.0.0/ 等
  python3 source/sync_tos.py config                   # 只推 family.json
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Iterable

warnings.filterwarnings("ignore")
import tos  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # otter_family/
SITE = os.path.dirname(ROOT)
FAMILY_JSON = f"{SITE}/family.json"
LIB = f"{ROOT}/library"  # 本地真相
BUCKET_BASE = "https://otter-family-site.tos-cn-beijing.volces.com"
SKIP = {".DS_Store", "__pycache__"}
SKIP_DIRS = {"__pycache__", "master._bak"}
PUBLIC_TOP = ("brand", "expr", "site")  # 进 current/ 公开树；source 仅 objects+manifest

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("video/mp4", ".mp4")


def load_family() -> dict:
    return json.loads(open(FAMILY_JSON, encoding="utf-8").read())


def save_family(data: dict) -> None:
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    open(FAMILY_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def client_env():
    names = ("TOS_AK", "TOS_SK", "TOS_BUCKET", "TOS_REGION", "TOS_ENDPOINT")
    env = {k: os.environ.get(k) for k in names}
    if not all(env.values()):
        sys.exit("缺少 TOS_*，先 source ~/.config/devkeys/env.sh")
    return tos.TosClientV2(env["TOS_AK"], env["TOS_SK"], env["TOS_ENDPOINT"], env["TOS_REGION"]), env


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def object_key(sha: str) -> str:
    return f"library/objects/{sha[:2]}/{sha}"


def put_object(client, bucket, key: str, data: bytes, *, public: bool, cache: str | None = None):
    ctype = "application/json" if key.endswith(".json") else (mimetypes.guess_type(key)[0] or "application/octet-stream")
    kw = {
        "content_type": ctype,
        "acl": tos.ACLType.ACL_Public_Read if public else tos.ACLType.ACL_Private,
        "storage_class": tos.StorageClassType.Storage_Class_Standard
        if public
        else tos.StorageClassType.Storage_Class_Ia,
    }
    if public:
        kw["cache_control"] = cache or ("no-cache" if key.endswith(".json") else "public, max-age=86400")
    client.put_object(bucket, key, content=data, **kw)


def remote_exists(client, bucket, key: str) -> bool:
    try:
        client.head_object(bucket, key)
        return True
    except Exception:
        return False


def list_keys(client, bucket, prefix: str) -> list[str]:
    out, token = [], None
    while True:
        r = client.list_objects_type2(bucket, prefix=prefix, continuation_token=token, list_only_once=True)
        out.extend(o.key for o in (r.contents or []))
        if not r.is_truncated:
            return out
        token = r.next_continuation_token


def walk_truth() -> Iterable[tuple[str, str, bool]]:
    """(相对 library/ 路径, 绝对路径, 是否公开)."""
    if not os.path.isdir(LIB):
        return
    for top in ("brand", "expr", "source", "site"):
        base = f"{LIB}/{top}"
        if not os.path.isdir(base):
            continue
        public = top in PUBLIC_TOP
        for d, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in SKIP and x not in SKIP_DIRS]
            for name in files:
                if name in SKIP or name.startswith("."):
                    continue
                path = f"{d}/{name}"
                rel = os.path.relpath(path, LIB).replace("\\", "/")
                yield rel, path, public


def bump_version(ver: str) -> str:
    parts = [int(x) for x in ver.split(".")]
    while len(parts) < 3:
        parts.append(0)
    parts[-1] += 1
    return ".".join(map(str, parts))


def load_remote_manifest(client, bucket, version: str) -> dict | None:
    key = f"library/versions/v{version}/manifest.json"
    try:
        data = client.get_object(bucket, key).read()
        return json.loads(data)
    except Exception:
        return None


def library_publish(argv: list[str]):
    dry = "--dry-run" in argv
    notes = ""
    version = None
    bump = "--bump" in argv
    i = 0
    while i < len(argv):
        if argv[i] == "--notes" and i + 1 < len(argv):
            notes = argv[i + 1]
            i += 2
            continue
        if argv[i] == "--version" and i + 1 < len(argv):
            version = argv[i + 1].lstrip("v")
            i += 2
            continue
        i += 1

    fam = load_family()
    cur = fam["family"].get("libraryVersion") or "1.0.0"
    if version is None:
        version = bump_version(cur) if bump else cur

    if not os.path.isdir(LIB):
        sys.exit(f"缺少本地真相目录 {LIB}，先整理 library/ 或 library pull")

    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    print(f"==> library publish v{version}（对象去重，不全量备份）")

    parent = None if version == "1.0.0" and not load_remote_manifest(client, bucket, "1.0.0") else cur
    if parent == version:
        prev = load_remote_manifest(client, bucket, version)
        parent = (prev or {}).get("parent")

    prev_files = {}
    if parent:
        pm = load_remote_manifest(client, bucket, parent)
        if pm:
            prev_files = pm.get("files") or {}

    files_meta: dict[str, dict] = {}
    new_objects = []
    unchanged = 0
    for rel, path, public in walk_truth():
        sha = sha256_file(path)
        size = os.path.getsize(path)
        files_meta[rel] = {"sha256": sha, "bytes": size, "public": public}
        prev = prev_files.get(rel)
        if prev and prev.get("sha256") == sha and remote_exists(client, bucket, object_key(sha)):
            unchanged += 1
            continue
        if remote_exists(client, bucket, object_key(sha)):
            unchanged += 1
            continue
        new_objects.append((sha, path, public))

    print(f"  文件 {len(files_meta)}，未变/已存在对象跳过，待上传对象 {len(new_objects)}")
    if dry:
        for sha, path, _ in new_objects[:30]:
            print(f"  + {object_key(sha)} ← {path}")
        return

    def up_obj(item):
        sha, path, public = item
        put_object(client, bucket, object_key(sha), open(path, "rb").read(), public=public)

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(up_obj, new_objects))

    manifest = {
        "schema": 2,
        "version": version,
        "parent": parent if parent != version else None,
        "publishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": notes,
        "files": files_meta,
    }
    put_object(
        client, bucket, f"library/versions/v{version}/manifest.json",
        json.dumps(manifest, ensure_ascii=False, indent=2).encode(), public=True, cache="no-cache",
    )

    # 物化 library/current/ 公开树（按文件增量）
    print("  更新 library/current/ 公开树…")
    current_remote = {k: True for k in list_keys(client, bucket, "library/current/")}
    wanted_current = set()
    todo_cur = []
    for rel, path, public in walk_truth():
        if not public:
            continue
        key = f"library/current/{rel}"
        wanted_current.add(key)
        # 用本地 md5 与远端 etag 比太贵；用 manifest sha：若与 parent 同且 key 已在 current，可跳过
        sha = files_meta[rel]["sha256"]
        if rel in prev_files and prev_files[rel].get("sha256") == sha and key in current_remote:
            continue
        todo_cur.append((key, path, True))
    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        def put_cur(item):
            key, path, pub = item
            put_object(client, bucket, key, open(path, "rb").read(), public=pub)
        list(pool.map(put_cur, todo_cur))
    extra = [k for k in current_remote if k not in wanted_current and not k.endswith("/")]
    for k in extra:
        client.delete_object(bucket, k)
    print(f"  current/ 上传 {len(todo_cur)}，删除多余 {len(extra)}")

    current = {
        "schema": 2,
        "version": version,
        "publishedAt": manifest["publishedAt"],
        "notes": notes,
        "manifest": f"library/versions/v{version}/manifest.json",
        "objects": f"{BUCKET_BASE}/library/objects/",
        "current": f"{BUCKET_BASE}/library/current/",
        "base": f"{BUCKET_BASE}/library/current/",
    }
    put_object(client, bucket, "library/current.json", json.dumps(current, ensure_ascii=False, indent=2).encode(), public=True, cache="no-cache")

    # family.json：官网走 current/；App 钉 libraryVersion
    fam["family"]["libraryVersion"] = version
    fam["family"]["library"] = f"{BUCKET_BASE}/library/current/"
    fam["family"]["brand"] = f"{BUCKET_BASE}/library/current/brand/"
    fam["family"]["expr"] = f"{BUCKET_BASE}/library/current/expr/"
    fam["family"]["media"] = f"{BUCKET_BASE}/library/current/site/{{app}}/"
    fam["family"]["libraryManifest"] = f"{BUCKET_BASE}/library/versions/v{{version}}/manifest.json"
    for app, meta in fam["apps"].items():
        meta["icon"] = f"{BUCKET_BASE}/library/current/brand/{app}/icon.png"
    save_family(fam)
    put_object(client, bucket, "config/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
    print(f"已发布 v{version}（新对象 {len(new_objects)}，清单 {BUCKET_BASE}/library/versions/v{version}/manifest.json）")


def library_pull(argv: list[str]):
    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    fam = load_family()
    version = None
    args = [a for a in argv if not a.startswith("--")]
    if args:
        version = args[0].lstrip("v")
    version = version or fam["family"].get("libraryVersion")
    if not version:
        cur = json.loads(client.get_object(bucket, "library/current.json").read())
        version = cur["version"]
    print(f"==> library pull v{version} → {LIB}")

    # 合并 parent 链：子覆盖父
    chain = []
    v = version
    seen = set()
    while v and v not in seen:
        seen.add(v)
        m = load_remote_manifest(client, bucket, v)
        if not m:
            # 兼容旧 flat library/vX/
            print(f"  无 versions/v{v}/manifest，尝试旧 layout…")
            return _pull_legacy_flat(client, bucket, v)
        chain.append(m)
        v = m.get("parent")
    merged: dict[str, dict] = {}
    for m in reversed(chain):
        merged.update(m.get("files") or {})

    todo = []
    for rel, meta in merged.items():
        path = f"{LIB}/{rel}"
        sha = meta["sha256"]
        if os.path.isfile(path) and sha256_file(path) == sha:
            continue
        todo.append((rel, sha, path, meta.get("public", True)))
    print(f"  待下载 {len(todo)} / 共 {len(merged)}")

    def get(item):
        rel, sha, path, public = item
        os.makedirs(os.path.dirname(path), exist_ok=True)
        key = object_key(sha)
        try:
            client.get_object_to_file(bucket, key, path)
        except Exception:
            # 回落 current/ 或旧 v 路径
            for alt in (f"library/current/{rel}", f"library/v{version}/{rel}"):
                try:
                    client.get_object_to_file(bucket, alt, path)
                    return
                except Exception:
                    continue
            raise SystemExit(f"无法下载 {rel} ({key})")

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, todo))
    print(f"已还原到 {LIB}")


def _pull_legacy_flat(client, bucket, version: str):
    prefix = f"library/v{version}/"
    keys = list_keys(client, bucket, prefix)
    todo = []
    for key in keys:
        if key.endswith("manifest.json") and key.count("/") <= 3:
            continue
        rel = key[len(prefix) :]
        path = f"{LIB}/{rel}"
        todo.append((key, path))
    print(f"  旧 layout 下载 {len(todo)}")
    def get(item):
        key, path = item
        os.makedirs(os.path.dirname(path), exist_ok=True)
        client.get_object_to_file(bucket, key, path)
    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, todo))


def library_cleanup(argv: list[str]):
    """删除过渡期旧前缀（不可逆）。"""
    dry = "--dry-run" in argv
    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    prefixes = [
        "brand/",
        "expr/v3/",
        "expr/v2/",
        "expr/v1/",
        "site/",
        "backup/expr/",
        "backup/source/",
        "library/v1.0.0/",  # 旧扁平整树；保留 versions/ 与 objects/ 与 current/
    ]
    for prefix in prefixes:
        keys = list_keys(client, bucket, prefix)
        # 不要误删 library/versions 或 objects 或 current
        keys = [k for k in keys if not k.startswith("library/versions/") and not k.startswith("library/objects/") and not k.startswith("library/current")]
        print(f"{prefix}: {len(keys)} 个" + ("（dry-run）" if dry else ""))
        if dry:
            continue
        def rm(k):
            client.delete_object(bucket, k)
        with ThreadPoolExecutor(16) as pool:
            list(pool.map(rm, keys))
    print("cleanup 完成")


def push_config():
    client, env = client_env()
    put_object(client, env["TOS_BUCKET"], "config/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
    print("config/family.json 已上传")


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    if argv[0] == "library":
        sub = argv[1] if len(argv) > 1 else ""
        rest = argv[2:]
        if sub == "publish":
            return library_publish(rest)
        if sub == "pull":
            return library_pull(rest)
        if sub == "cleanup":
            return library_cleanup(rest)
        sys.exit("library 子命令：publish | pull | cleanup")
    if argv[0] == "config":
        return push_config()
    sys.exit("请用：library publish|pull|cleanup  或 config")


if __name__ == "__main__":
    main()
