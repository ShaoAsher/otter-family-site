#!/usr/bin/env python3
"""Upload local otter-library → oss://otter/library/{latest,private}/ (parallel)."""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import oss2

for k in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
    os.environ.pop(k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tool"))
from sync_tos import LIB, LATEST_PREFIX, PRIVATE_PREFIX, delivery_mirrors, walk_truth  # noqa: E402

CFG = json.loads(Path.home().joinpath(".config/devkeys/config.json").read_text())
OSS = CFG["oss"]
WORKERS = int(os.environ.get("OSS_UPLOAD_WORKERS", "16"))

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("video/mp4", ".mp4")

lock = threading.Lock()
stats = {"ok": 0, "skip": 0, "fail": 0, "bytes": 0, "done": 0}


def targets() -> list[tuple[str, str, bool]]:
    out: list[tuple[str, str, bool]] = []
    seen: set[str] = set()
    for rel, path, _public, kind in walk_truth() or []:
        prefix = LATEST_PREFIX if kind == "latest" else PRIVATE_PREFIX
        key = prefix + rel
        if key not in seen:
            out.append((key, path, kind == "latest"))
            seen.add(key)
        for mrel, mpath, _ in delivery_mirrors(rel, path):
            mkey = LATEST_PREFIX + mrel
            if mkey not in seen:
                out.append((mkey, mpath, True))
                seen.add(mkey)
    fam = ROOT / "family.json"
    if fam.is_file():
        out.append(("library/family.json", str(fam), True))
    return out


def upload_one(bucket: oss2.Bucket, key: str, path: str, public: bool, total: int):
    try:
        size = Path(path).stat().st_size
        try:
            meta = bucket.head_object(key)
            if int(meta.content_length) == size:
                with lock:
                    stats["skip"] += 1
                    stats["done"] += 1
                    d = stats["done"]
                    if d % 50 == 0 or d == total:
                        print(
                            f"[{d}/{total}] ok={stats['ok']} skip={stats['skip']} "
                            f"fail={stats['fail']} up={stats['bytes']/1024/1024:.1f}MB",
                            flush=True,
                        )
                return
        except oss2.exceptions.OssError:
            pass

        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        headers = {"Content-Type": ctype}
        if public:
            headers["x-oss-object-acl"] = "public-read"
            headers["Cache-Control"] = "no-cache" if key.endswith(".json") else "public, max-age=86400"
        else:
            headers["x-oss-object-acl"] = "private"

        if size >= 16 * 1024 * 1024:
            print(f"PUT large {key} {size/1024/1024:.1f}MB", flush=True)
            oss2.resumable_upload(
                bucket,
                key,
                path,
                multipart_threshold=16 * 1024 * 1024,
                part_size=8 * 1024 * 1024,
                num_threads=4,
                headers=headers,
            )
        else:
            with open(path, "rb") as f:
                bucket.put_object(key, f, headers=headers)

        with lock:
            stats["ok"] += 1
            stats["bytes"] += size
            stats["done"] += 1
            d = stats["done"]
            if d % 50 == 0 or d == total:
                print(
                    f"[{d}/{total}] ok={stats['ok']} skip={stats['skip']} "
                    f"fail={stats['fail']} up={stats['bytes']/1024/1024:.1f}MB",
                    flush=True,
                )
    except Exception as e:
        with lock:
            stats["fail"] += 1
            stats["done"] += 1
        print(f"FAIL {key}: {e}", flush=True)


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else WORKERS
    auth = oss2.Auth(OSS["access_key_id"], OSS["access_key_secret"])
    # Each worker gets its own Bucket client (safer under concurrency)
    endpoint = f"https://{OSS['endpoint']}"
    name = OSS["bucket"]

    items = targets()
    total = len(items)
    bytes_total = sum(Path(p).stat().st_size for _, p, _ in items)
    print(
        f"local→OSS {total} objects, {bytes_total/1024/1024:.1f} MB, workers={workers} from {LIB}",
        flush=True,
    )
    t0 = time.time()

    def task(item):
        key, path, public = item
        b = oss2.Bucket(auth, endpoint, name)
        upload_one(b, key, path, public, total)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(task, it) for it in items]
        for fut in as_completed(futs):
            fut.result()

    print("done", dict(stats), f"elapsed={time.time()-t0:.0f}s", flush=True)
    if stats["fail"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
