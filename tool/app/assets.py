#!/usr/bin/env python3
"""按 App 根目录的 otter.json 拉取家族共用的二进制素材（只读公开地址，不要密钥，CI 也能跑）。

  ./tool/otter assets [pull]   # 缺的、内容不对的才下载；目录里多出来的 .webp 删掉
  ./tool/otter assets check    # 只校验，不下载；不一致时退出码 1
  （CI 里直接 python3 <家族仓>/tool/app/assets.py pull|check <App 根目录>）

otter.json：
  "expr": {"version": "v3", "dir": "assets/otter/expr"}
    → 从 TOS expr/<version>/ 取 manifest.json，anim_270/<key>.webp、still_270/<key>.webp 原样落到 <dir>/ 下，按 md5 落到 <dir>（该目录 gitignore，不进 App 仓库）。

下载先进本机缓存 ~/.cache/otter-family/（OTTER_CACHE 可改），几个 App 用同一表情版本只下一次。
包由素材库的 otter_family/source/sync_tos.py expr 发布。
"""

import hashlib
import json
import os
import shutil
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(os.environ.get("OTTER_CACHE") or Path.home() / ".cache" / "otter-family")


def base_url():
    return json.loads((ROOT / "family.json").read_text(encoding="utf-8"))["family"]["assets"]


def fetch(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return r.read()
        except OSError:
            if i == 2:
                raise


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def expr(app_root, pull):
    cfg = json.loads((app_root / "otter.json").read_text(encoding="utf-8"))["expr"]
    remote = f"{base_url()}expr/{cfg['version']}/"
    files = json.loads(fetch(remote + "manifest.json"))["files"]
    dest = app_root / cfg["dir"]
    cache = CACHE / "expr" / cfg["version"]
    wrong = [n for n, m in files.items() if not (dest / n).is_file() or md5(dest / n) != m["md5"]]
    extra = sorted(n for n in (p.relative_to(dest).as_posix() for p in dest.rglob("*.webp")) if n not in files) if dest.is_dir() else []
    label = f"表情包 {cfg['version']} → {cfg['dir']}"
    if not pull:
        if wrong or extra:
            print(f"{label}：缺或不一致 {len(wrong)} 个，多余 {len(extra)} 个；先跑 ./tool/otter assets", file=sys.stderr)
            return False
        print(f"{label}：{len(files)} 个，一致")
        return True

    def get(name):
        c = cache / name
        c.parent.mkdir(parents=True, exist_ok=True)
        (dest / name).parent.mkdir(parents=True, exist_ok=True)
        if not c.is_file() or md5(c) != files[name]["md5"]:
            data = fetch(remote + name)
            if hashlib.md5(data).hexdigest() != files[name]["md5"]:
                raise SystemExit(f"下载校验失败：{remote + name}")
            tmp = c.with_suffix(".part")
            tmp.write_bytes(data)
            tmp.replace(c)
        shutil.copyfile(c, dest / name)

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, wrong))
    for name in extra:
        (dest / name).unlink()
    print(f"{label}：更新 {len(wrong)} 个，删除多余 {len(extra)} 个，共 {len(files)} 个")
    return True


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] not in ("pull", "check"):
        sys.exit(__doc__)
    app_root = Path(argv[1] if len(argv) > 1 else ".").resolve()
    if not (app_root / "otter.json").is_file():
        sys.exit(f"{app_root} 下没有 otter.json")
    ok = expr(app_root, argv[0] == "pull")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
