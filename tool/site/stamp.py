#!/usr/bin/env python3
"""记下官网素材是从「哪一版 App 提交」出的：各 App 目录下的 build.json，随素材上 TOS。

  python3 tool/site/stamp.py <app> <part> <App 仓库路径> <输出目录> [键=值 ...]

<part> 是 demo / shots / art / promo；优先合并本地已有 build.json，否则读 TOS，只覆盖这一个 part。

字段区分（勿与家族 TOS 世代混淆）：
  parts.*.version   — App 版本号（pubspec 的 x.y.z，与 family.libraryVersion 同号空间）
  parts.*.appBuild  — App 安装包 build（pubspec 的 +N）；≠ family.libraryBuild
  family.libraryBuild 在 family.json / current.json，标识 TOS 素材树发版，由 lib publish 维护
"""

import json
import urllib.request
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PARTS = ("demo", "shots", "art", "promo")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True).stdout.strip()


def app_version_build(repo):
    """读 pubspec `x.y.z+N` → (version, appBuild)。appBuild 与 TOS libraryBuild 无关。"""
    for pub in (repo / "pubspec.yaml", repo / "app" / "pubspec.yaml"):
        if pub.is_file():
            m = re.search(r"^version:\s*([^\s+#]+)\+?(\d+)?", pub.read_text(), re.M)
            if m:
                return m.group(1), (m.group(2) or "")
    return "", ""


def remote(app):
    fam = json.loads((ROOT / "family.json").read_text())["family"]
    # URL 模板里的 {version} 是 libraryVersion（与 App 同号），不是 libraryBuild
    ver = fam.get("libraryVersion") or "1.1.0"
    media = fam["media"].replace("{version}", ver).replace("{app}", app)
    try:
        with urllib.request.urlopen(media + "build.json", timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return {"app": app, "parts": {}}


def load_base(app, out: Path):
    """连续 stamp 时优先合并本地已写出的 build.json，避免每次从 TOS 覆盖丢 part。"""
    if out.is_file():
        try:
            data = json.loads(out.read_text())
            if isinstance(data.get("parts"), dict):
                data.setdefault("app", app)
                return data
        except Exception:
            pass
    return remote(app)


def main():
    if len(sys.argv) < 5 or sys.argv[2] not in PARTS:
        sys.exit(__doc__)
    app, part, repo, out = sys.argv[1], sys.argv[2], Path(sys.argv[3]).resolve(), Path(sys.argv[4]) / "build.json"
    data = load_base(app, out)
    ver, app_build = app_version_build(repo)
    entry = {
        "version": ver,
        "appBuild": app_build,
        "commit": git(repo, "rev-parse", "--short", "HEAD"),
        "branch": git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(git(repo, "status", "--porcelain", "--untracked-files=no")),
        "at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
    }
    if not entry["appBuild"]:
        entry.pop("appBuild")
    # 兼容旧字段名 build → 一律写成 appBuild
    for kv in sys.argv[5:]:
        k, _, v = kv.partition("=")
        if k == "build":
            k = "appBuild"
        entry[k] = v
    data["parts"][part] = entry
    data["parts"] = {k: data["parts"][k] for k in PARTS if k in data["parts"]}
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    flag = "（有未提交改动）" if entry["dirty"] else ""
    vb = f"v{entry['version']}" + (f"+{entry['appBuild']}" if entry.get("appBuild") else "")
    print(f"==> build.json  {part} ← {entry['branch']}@{entry['commit']} app {vb}{flag}")


if __name__ == "__main__":
    main()
