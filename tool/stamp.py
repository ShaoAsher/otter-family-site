#!/usr/bin/env python3
"""记下官网素材是从 App 的哪个提交出的：BUILD.json，随素材一起传到 TOS site/<app>/BUILD.json。

  python3 tool/stamp.py <app> <part> <App 仓库路径> <输出目录> [键=值 ...]

<part> 是 demo / shots / art / promo；先读 TOS 上现有的那份，只覆盖这一个 part，写到 <输出目录>/BUILD.json。
App 仓库的 `tool/site.sh` 每步结束时调用。
"""

import json
import urllib.request
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ("demo", "shots", "art", "promo")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True).stdout.strip()


def version(repo):
    for pub in (repo / "pubspec.yaml", repo / "app" / "pubspec.yaml"):
        if pub.is_file():
            m = re.search(r"^version:\s*([^\s+]+)", pub.read_text(), re.M)
            if m:
                return m.group(1)
    return ""


def remote(app):
    media = json.loads((ROOT / "family.json").read_text())["family"]["media"].replace("{app}", app)
    try:
        with urllib.request.urlopen(media + "BUILD.json", timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return {"app": app, "parts": {}}


def main():
    if len(sys.argv) < 5 or sys.argv[2] not in PARTS:
        sys.exit(__doc__)
    app, part, repo, out = sys.argv[1], sys.argv[2], Path(sys.argv[3]).resolve(), Path(sys.argv[4]) / "BUILD.json"
    data = remote(app)
    entry = {
        "version": version(repo),
        "commit": git(repo, "rev-parse", "--short", "HEAD"),
        "branch": git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(git(repo, "status", "--porcelain", "--untracked-files=no")),
        "at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
    }
    for kv in sys.argv[5:]:
        k, _, v = kv.partition("=")
        entry[k] = v
    data["parts"][part] = entry
    data["parts"] = {k: data["parts"][k] for k in PARTS if k in data["parts"]}
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    flag = "（有未提交改动）" if entry["dirty"] else ""
    print(f"==> BUILD.json  {part} ← {entry['branch']}@{entry['commit']} v{entry['version']}{flag}")


if __name__ == "__main__":
    main()
