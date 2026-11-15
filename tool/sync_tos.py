#!/usr/bin/env python3
"""TOS 唯一根 library/

母版 library/private/：
  master/  source/still/  source/video/  expr/{still,anim}/{1080,540,270}/

对外 library/latest/：
  common/  otter-*/  expr/*/270/ + manifest.json

另：keep/vX/、release/、current.json、family.json

  ./tool/otter lib publish|pull
  python3 tool/sync_tos.py library publish|pull|wipe-legacy
  python3 tool/sync_tos.py config
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Iterable

warnings.filterwarnings("ignore")
import tos  # noqa: E402

from paths import family_site, library_root  # noqa: E402

SITE = family_site()
FAMILY_JSON = f"{SITE}/family.json"
LIB = library_root()
BUCKET_BASE = "https://otter-family-site.tos-cn-beijing.volces.com"
SKIP = {".DS_Store", "__pycache__"}
SKIP_DIRS = {"__pycache__", "master._bak", "_keep"}

# 本地顶层 → TOS 分区
PUBLIC_TOP = {"common", "otter-git", "otter-tools", "otter-gametime"}
PRIVATE_TOP = {"master", "source", "expr"}  # 三档表情整树属母版
PUBLIC_EXPR_SIZES = {"270"}  # 对外只挂交付档

LATEST_PREFIX = "library/latest/"
PRIVATE_PREFIX = "library/private/"
KEEP_PREFIX = "library/keep/"
RELEASE_PREFIX = "library/release/"

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


def list_keys(client, bucket, prefix: str) -> list[str]:
    out, token = [], None
    while True:
        r = client.list_objects_type2(bucket, prefix=prefix, continuation_token=token, list_only_once=True)
        out.extend(o.key for o in (r.contents or []))
        if not r.is_truncated:
            return out
        token = r.next_continuation_token


def is_public_expr_delivery(rel: str) -> bool:
    """expr/still|anim/270/… 与 expr/manifest.json 对外交付。"""
    if rel == "expr/manifest.json":
        return True
    parts = rel.split("/")
    # expr / still|anim / size / file
    return len(parts) >= 4 and parts[0] == "expr" and parts[1] in ("still", "anim") and parts[2] in PUBLIC_EXPR_SIZES


def walk_truth() -> Iterable[tuple[str, str, bool, str]]:
    """(rel, abs_path, public_flag_for_acl_of_primary, primary_key_prefix_kind).

    每条母版文件进 private；其中 270 交付档再镜像进 latest。
    返回 primary 写入：public=True 表示写 latest，False 写 private。
    """
    if not os.path.isdir(LIB):
        return
    for top in sorted(PUBLIC_TOP | PRIVATE_TOP):
        base = f"{LIB}/{top}"
        if not os.path.isdir(base):
            continue
        for d, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in SKIP and x not in SKIP_DIRS]
            for name in files:
                if name in SKIP or name.startswith("."):
                    continue
                path = f"{d}/{name}"
                rel = os.path.relpath(path, LIB).replace("\\", "/")
                if top in PUBLIC_TOP:
                    yield rel, path, True, "latest"
                else:
                    # 母版一律 private
                    yield rel, path, False, "private"


def delivery_mirrors(rel: str, path: str) -> list[tuple[str, str, bool]]:
    """母版中的对外交付档，额外写入 latest。"""
    if is_public_expr_delivery(rel):
        return [(rel, path, True)]
    return []


def bump_version(ver: str) -> str:
    parts = [int(x) for x in ver.split(".")]
    while len(parts) < 3:
        parts.append(0)
    parts[-1] += 1
    return ".".join(map(str, parts))


def load_current_json(client, bucket) -> dict | None:
    try:
        return json.loads(client.get_object(bucket, "library/current.json").read())
    except Exception:
        return None


def remote_index(client, bucket) -> dict[str, str]:
    out = {}
    for prefix in (LATEST_PREFIX, PRIVATE_PREFIX):
        for k in list_keys(client, bucket, prefix):
            if not k.endswith("/"):
                out[k] = k
    return out


def load_prev_files(client, bucket) -> dict[str, str]:
    cur = load_current_json(client, bucket) or {}
    out = {}
    for rel, meta in (cur.get("files") or {}).items():
        out[rel] = meta.get("sha256") if isinstance(meta, dict) else (meta or "")
    return out


def parse_publish_argv(argv: list[str]):
    dry = "--dry-run" in argv
    bump = "--bump" in argv
    keep_all = "--keep-all" in argv
    keep_none = "--keep-none" in argv
    notes, version, keeps = "", None, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--notes" and i + 1 < len(argv):
            notes, i = argv[i + 1], i + 2
            continue
        if a == "--version" and i + 1 < len(argv):
            version, i = argv[i + 1].lstrip("v"), i + 2
            continue
        if a == "--keep" and i + 1 < len(argv):
            keeps.append(argv[i + 1].lstrip("/"))
            i += 2
            continue
        i += 1
    return dry, bump, notes, version, keep_all, keep_none, keeps


def ask_keep(candidates: list[tuple[str, str]]) -> list[str]:
    if not candidates:
        return []
    if not sys.stdin.isatty():
        sys.exit("需确认 keep：传 --keep PATH / --keep-all / --keep-none")
    print("\n相对上一版公开树，保留到 keep/ 的有哪些？")
    for i, (rel, kind) in enumerate(candidates, 1):
        print(f"  [{i}] [{kind}] {rel}")
    raw = input("> ").strip().lower()
    if not raw or raw in ("none", "n", "0"):
        return []
    if raw in ("all", "a", "*"):
        return [rel for rel, _ in candidates]
    chosen = []
    for p in [x.strip() for x in raw.replace("，", ",").split(",") if x.strip()]:
        if p.isdigit() and 1 <= int(p) <= len(candidates):
            chosen.append(candidates[int(p) - 1][0])
        else:
            chosen.append(p.lstrip("/"))
    return chosen


def apply_family_urls(fam: dict, version: str) -> None:
    base = f"{BUCKET_BASE}/library/latest/"
    fam["family"]["libraryVersion"] = version
    fam["family"]["library"] = base
    fam["family"]["brand"] = base
    fam["family"]["expr"] = f"{base}expr/"  # 公开仅 270
    fam["family"]["media"] = f"{base}{{app}}/"
    fam["family"]["config"] = [
        f"{BUCKET_BASE}/library/family.json",
        "https://shaoasher.github.io/otter-family-site/family.json",
    ]
    fam["family"]["releases"] = {
        "cn": f"{BUCKET_BASE}/library/release/{{app}}/v{{version}}/{{file}}",
        "global": "https://github.com/ShaoAsher/otter-family-site/releases/download/{app}-v{version}/{file}",
        "page": "https://github.com/ShaoAsher/otter-family-site/releases/tag/{app}-v{version}",
    }
    fam["family"].pop("libraryManifest", None)
    for app, meta in fam["apps"].items():
        meta["icon"] = f"{base}{app}/icon.png"


def library_publish(argv: list[str]):
    dry, bump, notes, version, keep_all, keep_none, keeps = parse_publish_argv(argv)
    fam = load_family()
    old_ver = fam["family"].get("libraryVersion") or "0.0.0"
    version = version or (bump_version(old_ver) if bump else old_ver)
    if not os.path.isdir(LIB):
        sys.exit(f"缺少 {LIB}")

    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    print(f"==> publish v{version}  private=母版三档+源  latest=对外资源  lib={LIB}")

    # uploads: list of (key, path, public_acl)
    uploads: dict[str, tuple[str, bool]] = {}
    files_meta: dict[str, dict] = {}

    for rel, path, _is_pub_top, zone in walk_truth():
        sha = sha256_file(path)
        public_acl = zone == "latest"
        if zone == "private":
            key = f"{PRIVATE_PREFIX}{rel}"
            uploads[key] = (path, False)
            files_meta[rel] = {"sha256": sha, "bytes": os.path.getsize(path), "zone": "private"}
            for drel, dpath, _ in delivery_mirrors(rel, path):
                dkey = f"{LATEST_PREFIX}{drel}"
                uploads[dkey] = (dpath, True)
                files_meta[f"public:{drel}"] = {"sha256": sha, "bytes": os.path.getsize(dpath), "zone": "latest"}
        else:
            key = f"{LATEST_PREFIX}{rel}"
            uploads[key] = (path, True)
            files_meta[rel] = {"sha256": sha, "bytes": os.path.getsize(path), "zone": "latest"}

    prev = load_prev_files(client, bucket)
    remote = remote_index(client, bucket)

    # keep：仅公开 latest 相对路径（去掉 public: 前缀的交付档 + app 包）
    public_rels = {}
    for key, (path, pub) in uploads.items():
        if not pub:
            continue
        rel = key[len(LATEST_PREFIX) :]
        public_rels[rel] = sha256_file(path)

    candidates = []
    for rel, old_sha in sorted(prev.items()):
        if rel.startswith("public:"):
            rel = rel[len("public:") :]
        # 旧清单里 private 区不参与 keep
        meta_zone = None
        if rel in (prev and {}):
            pass
        # 启发式：母版路径不进 keep 候选
        top = rel.split("/", 1)[0]
        if top in PRIVATE_TOP and not is_public_expr_delivery(rel):
            continue
        if rel not in public_rels:
            if top in PUBLIC_TOP or is_public_expr_delivery(rel):
                candidates.append((rel, "removed"))
        elif old_sha and public_rels.get(rel) and old_sha != public_rels[rel]:
            candidates.append((rel, "changed"))

    if keep_none:
        keep_rels = []
    elif keep_all:
        keep_rels = [r for r, _ in candidates]
    elif keeps:
        keep_rels = list(keeps)
    elif dry:
        keep_rels = []
        for rel, kind in candidates:
            print(f"  keep候选 [{kind}] {rel}")
    elif candidates:
        keep_rels = ask_keep(candidates)
    else:
        keep_rels = []

    # 增量
    todo = []
    for key, (path, pub) in uploads.items():
        rel_for_prev = key[len(LATEST_PREFIX):] if pub else key[len(PRIVATE_PREFIX):]
        prev_sha = prev.get(rel_for_prev) or prev.get(f"public:{rel_for_prev}")
        if prev_sha == sha256_file(path) and key in remote:
            continue
        todo.append((key, path, pub))

    wanted = set(uploads.keys())
    managed = [k for k in remote if k.startswith(LATEST_PREFIX) or k.startswith(PRIVATE_PREFIX)]
    extras = [k for k in managed if k not in wanted]

    print(f"  对象 {len(uploads)}（母版+对外），上传 {len(todo)}，删 {len(extras)}，keep {len(keep_rels)}")
    if dry:
        for key, _, pub in todo[:50]:
            print(f"  + {'pub' if pub else 'priv'} {key}")
        return

    for rel in keep_rels:
        src = f"{LATEST_PREFIX}{rel}"
        if src in remote or True:
            try:
                data = client.get_object(bucket, src).read()
                put_object(client, bucket, f"{KEEP_PREFIX}v{old_ver}/{rel}", data, public=True)
            except Exception as e:
                print(f"  ! keep 失败 {rel}: {e}")

    def up(item):
        key, path, pub = item
        put_object(client, bucket, key, open(path, "rb").read(), public=pub)

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(up, todo))
    for k in extras:
        client.delete_object(bucket, k)

    cur_meta = load_current_json(client, bucket) or {}
    keep_list = list(dict.fromkeys(list(cur_meta.get("keep") or []) + ([old_ver] if keep_rels else [])))
    current = {
        "schema": 6,
        "version": version,
        "parent": old_ver if old_ver != version else cur_meta.get("parent"),
        "publishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": notes,
        "latest": f"{BUCKET_BASE}/library/latest/",
        "private": f"{BUCKET_BASE}/library/private/",
        "keep": keep_list,
        "files": files_meta,
    }
    put_object(
        client, bucket, "library/current.json",
        json.dumps(current, ensure_ascii=False, indent=2).encode(), public=True, cache="no-cache",
    )
    # 公开 expr manifest 只列 270 交付档
    try:
        full = json.loads(open(f"{LIB}/expr/manifest.json", encoding="utf-8").read())
        files = {k: v for k, v in (full.get("files") or {}).items() if "/270/" in k}
        slim = {**full, "files": files, "publicSizes": [270]}
        put_object(
            client, bucket, f"{LATEST_PREFIX}expr/manifest.json",
            json.dumps(slim, ensure_ascii=False, indent=1).encode(), public=True, cache="no-cache",
        )
    except Exception as e:
        print(f"  ! slim expr manifest: {e}")

    apply_family_urls(fam, version)
    save_family(fam)
    put_object(client, bucket, "library/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
    print(f"已发布 v{version}")


def library_pull(argv: list[str]):
    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    keep_ver = None
    i = 0
    while i < len(argv):
        if argv[i] == "--keep" and i + 1 < len(argv):
            keep_ver, i = argv[i + 1].lstrip("v"), i + 2
            continue
        i += 1
    if keep_ver:
        prefix = f"{KEEP_PREFIX}v{keep_ver}/"
        dest = f"{LIB}/_keep/v{keep_ver}"
        keys = [k for k in list_keys(client, bucket, prefix) if not k.endswith("/")]
        def get(item):
            key, path = item
            os.makedirs(os.path.dirname(path), exist_ok=True)
            client.get_object_to_file(bucket, key, path)
        with ThreadPoolExecutor(8) as pool:
            list(pool.map(get, [(k, f"{dest}/{k[len(prefix):]}") for k in keys]))
        print(f"keep → {dest}")
        return

    todo = []
    for prefix in (LATEST_PREFIX, PRIVATE_PREFIX):
        for k in list_keys(client, bucket, prefix):
            if k.endswith("/"):
                continue
            rel = k[len(prefix) :]
            # latest 里的 expr/270 与 private 里的 expr 可能重叠；private 优先写满母版
            path = f"{LIB}/{rel}"
            todo.append((k, path, prefix == PRIVATE_PREFIX))
    # private 后写，覆盖同路径的 latest 交付档 → 本地仍是完整母版
    todo.sort(key=lambda x: (0 if x[2] else 1))
    def get(item):
        key, path, _ = item
        os.makedirs(os.path.dirname(path), exist_ok=True)
        client.get_object_to_file(bucket, key, path)
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(get, todo))
    print(f"pull → {LIB} ({len(todo)})")


def wipe_legacy(argv: list[str]):
    dry = "--dry-run" in argv
    client, env = client_env()
    bucket = env["TOS_BUCKET"]
    doomed = []
    for prefix in ("config/", "release/"):
        doomed.extend(list_keys(client, bucket, prefix))
    for k in list_keys(client, bucket, "library/"):
        if k in ("library/current.json", "library/family.json"):
            continue
        if k.startswith(LATEST_PREFIX) or k.startswith(PRIVATE_PREFIX) or k.startswith(KEEP_PREFIX) or k.startswith(RELEASE_PREFIX):
            continue
        doomed.append(k)
    # latest 下误放的母版档（1080/540、source、master）清掉——由本次 publish extras 处理；这里扫旧 config
    doomed = sorted(set(doomed))
    print(f"wipe-legacy {len(doomed)}" + (" dry-run" if dry else ""))
    if dry:
        for k in doomed[:40]:
            print(" ", k)
        return
    with ThreadPoolExecutor(16) as pool:
        list(pool.map(lambda k: client.delete_object(bucket, k), doomed))


def migrate_release_into_library(client, bucket, *, dry: bool):
    keys = list_keys(client, bucket, "release/")
    print(f"migrate release → library/release: {len(keys)}")
    if dry:
        return
    for k in keys:
        put_object(client, bucket, "library/" + k, client.get_object(bucket, k).read(), public=True)
        client.delete_object(bucket, k)


def push_config():
    client, env = client_env()
    put_object(client, env["TOS_BUCKET"], "library/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
    print("library/family.json ok")


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    if argv[0] == "library":
        sub, rest = (argv[1] if len(argv) > 1 else ""), argv[2:]
        if sub == "publish":
            return library_publish(rest)
        if sub == "pull":
            return library_pull(rest)
        if sub in ("wipe-legacy", "cleanup"):
            return wipe_legacy(rest)
        if sub == "migrate-release":
            client, env = client_env()
            return migrate_release_into_library(client, env["TOS_BUCKET"], dry="--dry-run" in rest)
        sys.exit("library：publish | pull | wipe-legacy | migrate-release")
    if argv[0] == "config":
        return push_config()
    sys.exit("library … 或 config")


if __name__ == "__main__":
    main()
