#!/usr/bin/env python3
"""Mirror TOS library/ → Aliyun OSS otter.

Usage:
  python3 tool/migrate_tos_to_oss.py [workers] [--public-only]
"""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import oss2
import tos

# Avoid local HTTP proxy hanging cloud SDKs
for k in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

CFG = json.loads(Path.home().joinpath(".config/devkeys/config.json").read_text())
TOS = CFG["volc_tos"]
OSS = CFG["oss"]

PUBLIC_PREFIXES = (
    "library/latest/",
    "library/release/",
    "library/keep/",
    "library/family.json",
    "library/current.json",
)

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("video/mp4", ".mp4")

lock = threading.Lock()
stats = {"ok": 0, "skip": 0, "fail": 0, "bytes": 0}


def is_public(key: str) -> bool:
    if key in ("library/family.json", "library/current.json"):
        return True
    return any(key.startswith(p) for p in PUBLIC_PREFIXES[:3])


def list_tos_keys(client, bucket: str, prefix: str):
    token = None
    while True:
        r = client.list_objects_type2(
            bucket, prefix=prefix, continuation_token=token, list_only_once=True, max_keys=1000
        )
        for o in r.contents or []:
            yield o.key, o.size
        if not r.is_truncated:
            return
        token = r.next_continuation_token


def mirror_one(tos_c, oss_bucket, key: str, size: int):
    tmp = None
    try:
        try:
            meta = oss_bucket.head_object(key)
            if int(meta.content_length) == size:
                with lock:
                    stats["skip"] += 1
                return
        except oss2.exceptions.OssError:
            pass

        ctype = mimetypes.guess_type(key)[0] or "application/octet-stream"
        headers = {"Content-Type": ctype}
        if is_public(key):
            headers["x-oss-object-acl"] = "public-read"
            headers["Cache-Control"] = "no-cache" if key.endswith(".json") else "public, max-age=86400"
        else:
            headers["x-oss-object-acl"] = "private"

        # Stream to temp file to avoid multi-GB RAM with parallel workers
        fd, tmp = tempfile.mkstemp(prefix="otter-mirror-", suffix=Path(key).suffix or ".bin")
        os.close(fd)
        with open(tmp, "wb") as out:
            obj = tos_c.get_object(TOS["bucket"], key)
            while True:
                chunk = obj.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
        got = os.path.getsize(tmp)
        if size and got != size:
            raise RuntimeError(f"size mismatch tos={size} got={got}")

        if got >= 20 * 1024 * 1024:
            print(f"PUT large {key} {got/1024/1024:.1f}MB", flush=True)
            oss2.resumable_upload(
                oss_bucket,
                key,
                tmp,
                multipart_threshold=20 * 1024 * 1024,
                part_size=10 * 1024 * 1024,
                num_threads=2,
                headers=headers,
            )
        else:
            with open(tmp, "rb") as f:
                oss_bucket.put_object(key, f, headers=headers)

        with lock:
            stats["ok"] += 1
            stats["bytes"] += got
    except Exception as e:
        with lock:
            stats["fail"] += 1
        print(f"FAIL {key}: {e}", flush=True)
    finally:
        if tmp and os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass


def main():
    args = sys.argv[1:]
    public_only = "--public-only" in args
    args = [a for a in args if a != "--public-only"]
    workers = int(args[0]) if args else 6

    tos_c = tos.TosClientV2(TOS["access_key_id"], TOS["secret_access_key"], TOS["endpoint"], TOS["region"])
    auth = oss2.Auth(OSS["access_key_id"], OSS["access_key_secret"])
    oss_bucket = oss2.Bucket(auth, f"https://{OSS['endpoint']}", OSS["bucket"])

    print("listing TOS library/ …", flush=True)
    items = list(list_tos_keys(tos_c, TOS["bucket"], "library/"))
    if public_only:
        items = [(k, s) for k, s in items if is_public(k)]
    items.sort(key=lambda ks: (0 if is_public(ks[0]) else 1, ks[0]))
    total = len(items)
    total_bytes = sum(s for _, s in items)
    print(
        f"mirror {total} objects, {total_bytes/1024/1024:.1f} MB, workers={workers}, public_only={public_only}",
        flush=True,
    )
    t0 = time.time()
    # TOS Python client is not reliably thread-safe; keep transfers serial.
    # `workers` retained for CLI compat but ignored (>1 warns).
    if workers > 1:
        print(f"note: forcing serial transfer (requested workers={workers})", flush=True)
    for done, (k, s) in enumerate(items, 1):
        mirror_one(tos_c, oss_bucket, k, s)
        if done % 20 == 0 or done == total:
            elapsed = time.time() - t0
            print(
                f"[{done}/{total}] ok={stats['ok']} skip={stats['skip']} "
                f"fail={stats['fail']} up={stats['bytes']/1024/1024:.1f}MB {elapsed:.0f}s",
                flush=True,
            )
    print("done", stats, f"elapsed={time.time()-t0:.0f}s", flush=True)
    if stats["fail"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
