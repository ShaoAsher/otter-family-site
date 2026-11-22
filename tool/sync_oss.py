#!/usr/bin/env python3
"""OSS 唯一根 library/；本地 otter-library 与之同构。

  otter-library/latest/   ↔  library/latest/
  otter-library/private/  ↔  library/private/

另：release/、current.json、family.json

家族资源世代：
  libraryVersion  — 家族主版本（如 3.2.0），--version 对齐
  libraryBuild    — 仅 OSS 素材树发版；--bump 只涨这一位

  ./tool/otter lib publish|pull
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Iterable

import oss_store
from paths import family_site, library_latest, library_private, library_root  # noqa: E402

SITE = family_site()
FAMILY_JSON = f"{SITE}/family.json"
LIB = library_root()
LATEST = library_latest()
PRIVATE = library_private()
BUCKET_BASE = oss_store.BUCKET_BASE
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

# 本地/OSS 公开顶栏（均在 latest/ 下）
PUBLIC_TOP = {"catalog", "common", "brand", "media", "badges", "platform", "shots", "expr"}
PRIVATE_TOP = {"master", "source", "expr"}
PUBLIC_EXPR_SIZES = {"270", "540"}

LATEST_PREFIX = "library/latest/"
PRIVATE_PREFIX = "library/private/"
KEEP_PREFIX = "library/keep/"
RELEASE_PREFIX = "library/release/"


def load_family() -> dict:
    return json.loads(open(FAMILY_JSON, encoding="utf-8").read())


def save_family(data: dict) -> None:
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    open(FAMILY_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def client_env():
    """返回 (oss Bucket, 兼容旧调用的假 env)。"""
    return oss_store.bucket(), {"OSS_BUCKET": "otter"}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def put_object(client, bucket, key: str, data: bytes, *, public: bool, cache: str | None = None):
    # bucket 参数保留兼容；实际用 client（oss2.Bucket）
    oss_store.put_bytes(client, key, data, public=public, cache=cache)


def list_keys(client, bucket, prefix: str) -> list[str]:
    return oss_store.list_keys(client, prefix)

def is_public_expr_delivery(rel: str) -> bool:
    """expr/still|anim/270|540/… 与 expr/manifest.json 对外交付。"""
    if rel == "expr/manifest.json":
        return True
    parts = rel.split("/")
    return (
        len(parts) >= 4
        and parts[0] == "expr"
        and parts[1] in ("still", "anim")
        and parts[2] in PUBLIC_EXPR_SIZES
    )


def walk_truth() -> Iterable[tuple[str, str, bool, str]]:
    """(rel_under_zone, abs_path, unused, zone).

    本地 latest/ → OSS library/latest/；private/ → library/private/。
    不跟软链；硬链会按路径各传一次（内容相同）。
    """
    for zone, base in (("latest", LATEST), ("private", PRIVATE)):
        if not os.path.isdir(base):
            continue
        for d, dirs, files in os.walk(base):
            dirs[:] = [
                x
                for x in dirs
                if x not in SKIP and x not in SKIP_DIRS and not os.path.islink(f"{d}/{x}")
            ]
            for name in files:
                if name in SKIP or name.startswith("."):
                    continue
                path = f"{d}/{name}"
                if os.path.islink(path):
                    continue
                rel = os.path.relpath(path, base).replace("\\", "/")
                yield rel, path, zone == "latest", zone


def delivery_mirrors(rel: str, path: str) -> list[tuple[str, str, bool]]:
    """兼容旧调用：本地已同构，不再从 private 镜像到 latest。"""
    return []


def library_id(version: str, build: str | int | None) -> str:
    """家族 OSS 世代：version+libraryBuild。build 空则只返回 version。"""
    b = "" if build is None else str(build).strip()
    return f"{version}+{b}" if b else version


def parse_library_id(raw: str) -> tuple[str, str]:
    """解析 3.0.2+16；兼容旧假版本 3.0.16（无 +）→ version 原样、build 空。"""
    s = (raw or "").strip().lstrip("v")
    if "+" in s:
        ver, _, b = s.partition("+")
        return ver, b
    return s, ""


def bump_library_build(build: str | int | None) -> str:
    try:
        return str(int(str(build or "0").strip() or "0") + 1)
    except ValueError:
        return "1"


def load_current_json(client, bucket=None) -> dict | None:
    try:
        return json.loads(oss_store.get_bytes(client, "library/current.json"))
    except Exception:
        return None


def remote_index(client, bucket=None) -> dict[str, str]:
    out = {}
    for prefix in (LATEST_PREFIX, PRIVATE_PREFIX):
        for k in list_keys(client, bucket, prefix):
            if not k.endswith("/"):
                out[k] = k
    return out


def load_prev_files(client, bucket=None) -> dict[str, str]:
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
    notes, version, build, keeps = "", None, None, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--notes" and i + 1 < len(argv):
            notes, i = argv[i + 1], i + 2
            continue
        if a == "--version" and i + 1 < len(argv):
            # 与 App 版本号对齐；可写 3.0.2 或 3.0.2+1（顺带设 libraryBuild）
            raw = argv[i + 1].lstrip("v")
            ver, b = parse_library_id(raw)
            version = ver
            if b:
                build = b
            i += 2
            continue
        if a == "--build" and i + 1 < len(argv):
            # 仅设 libraryBuild（OSS 资源世代），与 App pubspec +N 无关
            build, i = argv[i + 1].lstrip("+"), i + 2
            continue
        if a == "--keep" and i + 1 < len(argv):
            keeps.append(argv[i + 1].lstrip("/"))
            i += 2
            continue
        i += 1
    return dry, bump, notes, version, build, keep_all, keep_none, keeps


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


def apply_family_urls(fam: dict, version: str, build: str) -> None:
    base = f"{BUCKET_BASE}/library/latest/"
    # libraryVersion ≡ App 版本号；libraryBuild 仅 OSS 素材世代（≠ App pubspec build）
    fam["family"]["libraryVersion"] = version
    fam["family"]["libraryBuild"] = str(build)
    fam["family"]["library"] = base
    fam["family"]["brand"] = f"{base}brand/"
    fam["family"]["expr"] = f"{base}expr/"  # 公开仅 270/540
    fam["family"]["media"] = f"{base}media/{{app}}/"
    fam["family"]["shots"] = f"{base}shots/{{app}}/"
    fam["family"]["badges"] = f"{base}badges/{{app}}/"
    fam["family"]["platform"] = f"{base}platform/{{app}}/"
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
        meta["icon"] = f"{base}brand/{app}/icon.png"


def resolve_library_generation(fam: dict, *, bump: bool, version: str | None, build: str | None) -> tuple[str, str, str, str]:
    """返回 (new_version, new_build, old_id, new_id)。

    - --bump：只涨 libraryBuild（素材小改，不碰与 App 同号的 version）
    - --version：与 App 版本号对齐；未带 --build/--bump 时 libraryBuild 从 1 起
    - --version + --bump：对齐 version 且 libraryBuild=1
    - --build：显式指定 libraryBuild（与 App pubspec +N 无关）
    """
    old_ver = fam["family"].get("libraryVersion") or "0.0.0"
    old_build = str(fam["family"].get("libraryBuild") or "").strip()
    old_id = library_id(old_ver, old_build) if old_build else old_ver

    new_ver = version or old_ver
    version_changed = bool(version) and version != old_ver

    if build is not None:
        new_build = str(build).strip()
    elif bump and version_changed:
        new_build = "1"
    elif bump:
        new_build = bump_library_build(old_build or "0")
    elif version_changed:
        new_build = "1"
    else:
        new_build = old_build or "0"

    return new_ver, new_build, old_id, library_id(new_ver, new_build)


def library_publish(argv: list[str]):
    dry, bump, notes, version, build, keep_all, keep_none, keeps = parse_publish_argv(argv)
    fam = load_family()
    version, build, old_id, new_id = resolve_library_generation(fam, bump=bump, version=version, build=build)
    if not os.path.isdir(LIB):
        sys.exit(f"缺少 {LIB}")

    try:
        from library_catalog import write as write_catalog

        write_catalog()
    except Exception as e:
        print(f"  ! catalog: {e}")

    client, env = client_env()
    bucket = env.get("OSS_BUCKET", "otter")
    print(
        f"==> publish library {new_id}  (libraryVersion={version} 与 App 同号；"
        f"libraryBuild={build} 仅 OSS，≠ App build)  lib={LIB}"
    )

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
                data = oss_store.get_bytes(client, src)
                # keep 目录用完整世代 id（含 libraryBuild），避免与 App 版本目录混淆
                put_object(client, bucket, f"{KEEP_PREFIX}v{old_id}/{rel}", data, public=True)
            except Exception as e:
                print(f"  ! keep 失败 {rel}: {e}")

    def up(item):
        key, path, pub = item
        put_object(client, bucket, key, open(path, "rb").read(), public=pub)

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(up, todo))
    for k in extras:
        oss_store.delete(client, k)

    cur_meta = load_current_json(client, bucket) or {}
    keep_list = list(dict.fromkeys(list(cur_meta.get("keep") or []) + ([old_id] if keep_rels else [])))
    current = {
        "schema": 7,
        "version": version,  # = libraryVersion，与 App 版本号一致
        "build": build,  # = libraryBuild，仅 OSS 素材世代（≠ App pubspec build）
        "id": new_id,
        "parent": old_id if old_id != new_id else cur_meta.get("parent"),
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
    # 公开 expr manifest：270（默认）+ 540（高清动图开关）
    try:
        full = json.loads(open(f"{LATEST}/expr/manifest.json", encoding="utf-8").read())
        files = {
            k: v
            for k, v in (full.get("files") or {}).items()
            if "/270/" in k or "/540/" in k
        }
        slim = {**full, "files": files, "publicSizes": [270, 540]}
        put_object(
            client, bucket, f"{LATEST_PREFIX}expr/manifest.json",
            json.dumps(slim, ensure_ascii=False, indent=1).encode(), public=True, cache="no-cache",
        )
    except Exception as e:
        print(f"  ! slim expr manifest: {e}")

    apply_family_urls(fam, version, build)
    save_family(fam)
    put_object(client, bucket, "library/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
    print(f"已发布 library {new_id}")


def library_pull(argv: list[str]):
    client, _env = client_env()
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
        keys = [k for k in list_keys(client, None, prefix) if not k.endswith("/")]
        def get(item):
            key, path = item
            os.makedirs(os.path.dirname(path), exist_ok=True)
            client.get_object_to_file(key, path)
        with ThreadPoolExecutor(8) as pool:
            list(pool.map(get, [(k, f"{dest}/{k[len(prefix):]}") for k in keys]))
        print(f"keep → {dest}")
        return

    todo = []
    for prefix, zone_root in ((LATEST_PREFIX, LATEST), (PRIVATE_PREFIX, PRIVATE)):
        for k in list_keys(client, None, prefix):
            if k.endswith("/"):
                continue
            rel = k[len(prefix) :]
            path = f"{zone_root}/{rel}"
            todo.append((k, path, prefix == PRIVATE_PREFIX))
    todo.sort(key=lambda x: (0 if x[2] else 1))
    def get(item):
        key, path, _ = item
        os.makedirs(os.path.dirname(path), exist_ok=True)
        client.get_object_to_file(key, path)
    with ThreadPoolExecutor(8) as pool:
        list(pool.map(get, todo))
    print(f"pull → {LIB} ({len(todo)})")


def wipe_legacy(argv: list[str]):
    dry = "--dry-run" in argv
    client, _env = client_env()
    doomed = []
    for prefix in ("config/", "release/"):
        doomed.extend(list_keys(client, None, prefix))
    for k in list_keys(client, None, "library/"):
        if k in ("library/current.json", "library/family.json"):
            continue
        if k.startswith(LATEST_PREFIX) or k.startswith(PRIVATE_PREFIX) or k.startswith(KEEP_PREFIX) or k.startswith(RELEASE_PREFIX):
            continue
        doomed.append(k)
    doomed = sorted(set(doomed))
    print(f"wipe-legacy {len(doomed)}" + (" dry-run" if dry else ""))
    if dry:
        for k in doomed[:40]:
            print(" ", k)
        return
    with ThreadPoolExecutor(16) as pool:
        list(pool.map(lambda k: oss_store.delete(client, k), doomed))


def migrate_release_into_library(client, bucket=None, *, dry: bool):
    keys = list_keys(client, None, "release/")
    print(f"migrate release → library/release: {len(keys)}")
    if dry:
        return
    for k in keys:
        put_object(client, None, "library/" + k, oss_store.get_bytes(client, k), public=True)
        oss_store.delete(client, k)


def push_config():
    client, _env = client_env()
    put_object(client, None, "library/family.json", open(FAMILY_JSON, "rb").read(), public=True, cache="no-cache")
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
            client, _env = client_env()
            return migrate_release_into_library(client, dry="--dry-run" in rest)
        sys.exit("library：publish | pull | wipe-legacy | migrate-release")
    if argv[0] == "config":
        return push_config()
    sys.exit("library … 或 config")


if __name__ == "__main__":
    main()
