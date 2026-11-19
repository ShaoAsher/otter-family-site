#!/usr/bin/env python3
"""水獭家族统一发布安装包：国内 OSS + 海外 GitHub Release（仅官网仓），两处齐了再切换下载版本。

旧火山 TOS 只作存档，本脚本不再读写 TOS。

  ./tool/otter publish <app> <版本> 文件...   # 上传 OSS +（官网仓）GitHub Release；齐了就切换
  ./tool/otter mirror  <app> <版本> [--force] # 把 GitHub 上已有的包补到 OSS，齐了就切换
  ./tool/otter status  [app]
  python3 tool/release/release.py site <app> <目录>  # 官网素材 → OSS library/latest/<app>/

OSS 路径 `library/release/<app>/v<版本>/<文件名>`，public-read。
「切换」= 改 family.json 的 download.version，并推 library/family.json 到 OSS。
"""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tool"))
import oss_store  # noqa: E402

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("text/vtt", ".vtt")

CONFIG = ROOT / "family.json"
REPO = "ShaoAsher/otter-family-site"  # 官网仓；安装包海外镜像仍挂这里的 Release


def load():
    return json.loads(CONFIG.read_text(), object_pairs_hook=OrderedDict)


def save(cfg):
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")


def app_of(cfg, app):
    a = cfg["apps"].get(app)
    if not a or not a.get("download"):
        sys.exit(
            f"family.json 里没有可下载的 App「{app}」，可选："
            f"{[k for k, v in cfg['apps'].items() if v.get('download')]}"
        )
    return a


def tag(app, version):
    return f"{app}-v{version}"


def parts(v):
    return [int(p) if p.isdigit() else 0 for p in v.split("+")[0].split(".")]


def oss_key(app, version, name):
    return f"library/release/{app}/v{version}/{name}"


def gh(*args, check=True):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"gh {' '.join(args[:3])} 失败：{r.stderr.strip()}")
    return r


def gh_assets(app, version):
    r = gh("release", "view", tag(app, version), "--repo", REPO, "--json", "assets", check=False)
    if r.returncode:
        return None
    return {a["name"] for a in json.loads(r.stdout)["assets"]}


def notes(cfg, app, version, sums):
    a = cfg["apps"][app]
    entry = next((c for c in a.get("changelog", []) if c.get("version") == version), None)
    lines = [f"{a['name']} {version}", ""]
    if entry:
        lines += [entry["zh"], ""]
    lines += [f"官网：{a['site']}", ""]
    if sums:
        lines += ["SHA256", "```"] + [f"{h}  {n}" for n, h in sorted(sums.items())] + ["```"]
    return "\n".join(lines)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def missing(cfg, app, version, bkt):
    files_map = app_of(cfg, app)["download"]["files"]
    # OTTER_SKIP_WIN=1：只校验 mac 包，允许先切 download.version（Win 稍后 mirror）
    if os.environ.get("OTTER_SKIP_WIN", "").strip() in ("1", "true", "yes"):
        files = [n for k, n in files_map.items() if not str(k).startswith("windows")]
    else:
        files = list(files_map.values())
    on_gh = gh_assets(app, version) or set()
    return [
        (n, w)
        for n in files
        for w, ok in (
            ("GitHub", n in on_gh),
            ("OSS", oss_store.has(bkt, oss_key(app, version, n))),
        )
        if not ok
    ]


def switch(cfg, app, version, bkt):
    a = app_of(cfg, app)
    lack = missing(cfg, app, version, bkt)
    if lack:
        print(f"还缺 {len(lack)} 个，暂不切换下载版本：")
        for n, w in lack:
            print(f"  {w:6} {n}")
        print(f"补齐后再跑：./tool/otter mirror {app} {version}")
        return
    if a["download"].get("version") == version:
        print(f"下载版本已是 {version}")
        return
    a["download"]["version"] = version
    if parts(version) > parts(a.get("latest", "0")):
        a["latest"] = version
    if not any(c.get("version") == version for c in a.get("changelog", [])):
        print(f"提醒：family.json 的 {app}.changelog 里还没有 {version} 这一条")
    save(cfg)
    oss_store.put_bytes(
        bkt, "library/family.json", CONFIG.read_bytes(), public=True, cache="no-cache"
    )
    print(f"已切换 {app} 的下载版本为 {version}，library/family.json 已推到 OSS")
    print("接着提交 family.json 并推官网仓 main，Pages 随之更新")


def publish(app, version, paths):
    cfg = load()
    files = set(app_of(cfg, app)["download"]["files"].values())
    paths = [Path(p) for p in paths]
    for p in paths:
        if not p.is_file():
            sys.exit(f"找不到文件 {p}")
        if p.name not in files:
            sys.exit(f"{p.name} 不是 {app} 的发布文件名，应为：{sorted(files)}")
    bkt = oss_store.bucket()

    sums = {p.name: sha256(p) for p in paths}
    t = tag(app, version)
    if gh_assets(app, version) is None:
        print(f"==> GitHub 建 Release {t}")
        gh(
            "release",
            "create",
            t,
            *map(str, paths),
            "--repo",
            REPO,
            "--title",
            f"{cfg['apps'][app]['name']} {version}",
            "--notes",
            notes(cfg, app, version, sums),
            "--latest=false",
        )
    else:
        print(f"==> GitHub 覆盖上传到 {t}")
        gh("release", "upload", t, *map(str, paths), "--repo", REPO, "--clobber")
        gh("release", "edit", t, "--repo", REPO, "--notes", notes(cfg, app, version, sums))
    for p in paths:
        print(f"==> OSS    {p.name}")
        oss_store.put_file(bkt, oss_key(app, version, p.name), str(p), public=True)
    switch(cfg, app, version, bkt)


def mirror(app, version, force=False):
    cfg = load()
    bkt = oss_store.bucket()
    on_gh = gh_assets(app, version)
    if on_gh is None:
        sys.exit(f"GitHub 上没有 Release {tag(app, version)}")
    todo = [
        n
        for k, n in app_of(cfg, app)["download"]["files"].items()
        if n in on_gh
        and (
            force
            and k.startswith("windows")
            or not oss_store.has(bkt, oss_key(app, version, n))
        )
    ]
    with tempfile.TemporaryDirectory() as tmp:
        for n in todo:
            print(f"==> GitHub → OSS  {n}")
            gh("release", "download", tag(app, version), "--repo", REPO, "--pattern", n, "--dir", tmp)
            oss_store.put_file(bkt, oss_key(app, version, n), str(Path(tmp) / n), public=True)
    switch(cfg, app, version, bkt)


def status(only):
    cfg = load()
    bkt = oss_store.bucket()
    for app, a in cfg["apps"].items():
        if only and app != only or not a.get("download"):
            continue
        v = a["download"]["version"]
        lack = missing(cfg, app, v, bkt)
        print(
            f"{app:6} 下载 v{v}  最新 v{a.get('latest')}  "
            + ("OSS+GitHub 齐全" if not lack else "缺：" + "、".join(f"{w} {n}" for n, w in lack))
        )


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def site(app, folder):
    if app not in load()["apps"]:
        sys.exit(f"family.json 里没有 App「{app}」")
    folder = Path(folder)
    if not folder.is_dir():
        sys.exit(f"找不到目录 {folder}")
    bkt = oss_store.bucket()
    prefixes = [f"library/latest/{app}/"]

    def sync_prefix(prefix):
        remote = {obj.key: obj.etag.strip('"') for obj in __import__("oss2").ObjectIterator(bkt, prefix=prefix)}
        local = {
            prefix + p.relative_to(folder).as_posix(): p
            for p in sorted(folder.rglob("*"))
            if p.is_file() and not p.name.startswith(".")
        }
        todo = [(k, p) for k, p in local.items() if remote.get(k) != md5(p)]
        dirs = {p.name for p in folder.iterdir() if p.is_dir()}
        extra = [k for k in remote if k not in local and k[len(prefix) :].split("/")[0] in dirs]
        size = sum(p.stat().st_size for _, p in todo)
        print(
            f"==> OSS {prefix}  上传 {len(todo)} 个（{size / 1e6:.1f} MB），"
            f"删除 {len(extra)} 个，未变 {len(local) - len(todo)} 个"
        )

        def put(item):
            k, p = item
            oss_store.put_file(bkt, k, str(p), public=True, cache="public, max-age=600")

        with ThreadPoolExecutor(8) as pool:
            list(pool.map(put, todo))
            list(pool.map(lambda k: oss_store.delete(bkt, k), extra))

    for prefix in prefixes:
        sync_prefix(prefix)


def main():
    argv = sys.argv[1:]
    if len(argv) >= 4 and argv[0] == "publish":
        publish(argv[1], argv[2], argv[3:])
    elif len(argv) in (3, 4) and argv[0] == "mirror" and argv[3:] in ([], ["--force"]):
        mirror(argv[1], argv[2], force=argv[3:] == ["--force"])
    elif len(argv) == 3 and argv[0] == "site":
        site(argv[1], argv[2])
    elif argv[:1] == ["status"] and len(argv) <= 2:
        status(argv[1] if len(argv) == 2 else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
