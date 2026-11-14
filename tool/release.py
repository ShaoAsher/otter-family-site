#!/usr/bin/env python3
"""水獭家族统一发布安装包：国内 TOS + 海外 GitHub Release，两处齐了再切换官网与 App 的下载版本。

  source ~/.config/devkeys/env.sh        # 提供 TOS_AK / TOS_SK / TOS_BUCKET / TOS_REGION / TOS_ENDPOINT
  python3 tool/release.py publish <app> <版本> 文件...   # 上传到两处；全平台齐了就切换
  python3 tool/release.py mirror  <app> <版本>           # 把 GitHub 上已有的包（Windows CI 传的）补到 TOS，齐了就切换
  python3 tool/release.py status  [app]                  # 各 App 当前下载版本，以及该版本各平台在两处是否都在
  python3 tool/release.py site    <app> <目录>           # 官网素材同步到 TOS site/<app>/（App 的 tool/site.sh 调用）

<app> 是 family.json 里 apps 的键（git / tools / …）；文件名必须是该 App `download.files` 里的某个值。
GitHub Release 建在本仓（ShaoAsher/otter-family-site），标签 `<app>-v<版本>`，不标记为 latest。
TOS 路径 `release/<app>/<版本>/<文件名>`，公共读。
「切换」= 改 family.json 的 `download.version`（必要时同步 `latest`），并把 family.json 推到 TOS；
之后提交 family.json 并推 main（README「分支与上线」），Pages 上的那份才会更新。

site：按 MD5 只传有变化的文件，公共读，缓存 10 分钟（覆盖后很快生效）。<目录> 里有的子目录（shots/、demo/…）
会删掉远端多出来的文件；顶层文件（宣传片、封面等）只增不删。
"""

import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
import warnings
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

warnings.filterwarnings("ignore")
import tos  # noqa: E402

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("text/vtt", ".vtt")

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "family.json"
REPO = "ShaoAsher/otter-family-site"


def load():
    return json.loads(CONFIG.read_text(), object_pairs_hook=OrderedDict)


def save(cfg):
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")


def app_of(cfg, app):
    a = cfg["apps"].get(app)
    if not a or not a.get("download"):
        sys.exit(f"family.json 里没有可下载的 App「{app}」，可选：{[k for k, v in cfg['apps'].items() if v.get('download')]}")
    return a


def tag(app, version):
    return f"{app}-v{version}"


def parts(v):
    return [int(p) if p.isdigit() else 0 for p in v.split("+")[0].split(".")]


def tos_client():
    names = ("TOS_AK", "TOS_SK", "TOS_BUCKET", "TOS_REGION", "TOS_ENDPOINT")
    env = {k: os.environ.get(k) for k in names}
    if not all(env.values()):
        sys.exit("缺少 TOS_* 环境变量，先执行 source ~/.config/devkeys/env.sh")
    return tos.TosClientV2(env["TOS_AK"], env["TOS_SK"], env["TOS_ENDPOINT"], env["TOS_REGION"]), env["TOS_BUCKET"]


def tos_key(app, version, name):
    return f"release/{app}/{version}/{name}"


def tos_has(client, bucket, key):
    try:
        client.head_object(bucket, key)
        return True
    except tos.exceptions.TosServerError as e:
        if e.status_code == 404:
            return False
        raise


def tos_put(client, bucket, key, path):
    client.upload_file(
        bucket, key, str(path),
        acl=tos.ACLType.ACL_Public_Read,
        content_type="application/octet-stream",
        content_disposition=f'attachment; filename="{Path(path).name}"',
        cache_control="public, max-age=31536000, immutable",
        part_size=16 * 1024 * 1024, task_num=4, enable_checkpoint=False,
    )


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


def missing(cfg, app, version, client, bucket):
    files = app_of(cfg, app)["download"]["files"].values()
    on_gh = gh_assets(app, version) or set()
    return [(n, w) for n in files for w, ok in (("GitHub", n in on_gh), ("TOS", tos_has(client, bucket, tos_key(app, version, n)))) if not ok]


def switch(cfg, app, version, client, bucket):
    a = app_of(cfg, app)
    lack = missing(cfg, app, version, client, bucket)
    if lack:
        print(f"还缺 {len(lack)} 个，暂不切换下载版本：")
        for n, w in lack:
            print(f"  {w:6} {n}")
        print(f"补齐后再跑：python3 tool/release.py mirror {app} {version}")
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
    client.put_object(
        bucket, "config/family.json", content=CONFIG.read_bytes(),
        content_type="application/json", cache_control="no-cache", acl=tos.ACLType.ACL_Public_Read,
    )
    print(f"已切换 {app} 的下载版本为 {version}，family.json 已推到 TOS")
    print("接着提交 family.json 并推 main（见 README「分支与上线」），Pages 与产品官网随之更新")


def publish(app, version, paths):
    cfg = load()
    files = set(app_of(cfg, app)["download"]["files"].values())
    paths = [Path(p) for p in paths]
    for p in paths:
        if not p.is_file():
            sys.exit(f"找不到文件 {p}")
        if p.name not in files:
            sys.exit(f"{p.name} 不是 {app} 的发布文件名，应为：{sorted(files)}")
    client, bucket = tos_client()

    sums = {p.name: sha256(p) for p in paths}
    t = tag(app, version)
    if gh_assets(app, version) is None:
        print(f"==> GitHub 建 Release {t}")
        gh("release", "create", t, *map(str, paths), "--repo", REPO, "--title", f"{cfg['apps'][app]['name']} {version}",
           "--notes", notes(cfg, app, version, sums), "--latest=false")
    else:
        print(f"==> GitHub 覆盖上传到 {t}")
        gh("release", "upload", t, *map(str, paths), "--repo", REPO, "--clobber")
        gh("release", "edit", t, "--repo", REPO, "--notes", notes(cfg, app, version, sums))
    for p in paths:
        print(f"==> TOS    {p.name}")
        tos_put(client, bucket, tos_key(app, version, p.name), p)
    switch(cfg, app, version, client, bucket)


def mirror(app, version):
    cfg = load()
    client, bucket = tos_client()
    on_gh = gh_assets(app, version)
    if on_gh is None:
        sys.exit(f"GitHub 上没有 Release {tag(app, version)}")
    todo = [n for n in app_of(cfg, app)["download"]["files"].values()
            if n in on_gh and not tos_has(client, bucket, tos_key(app, version, n))]
    with tempfile.TemporaryDirectory() as tmp:
        for n in todo:
            print(f"==> GitHub → TOS  {n}")
            gh("release", "download", tag(app, version), "--repo", REPO, "--pattern", n, "--dir", tmp)
            tos_put(client, bucket, tos_key(app, version, n), Path(tmp) / n)
    switch(cfg, app, version, client, bucket)


def status(only):
    cfg = load()
    client, bucket = tos_client()
    for app, a in cfg["apps"].items():
        if only and app != only or not a.get("download"):
            continue
        v = a["download"]["version"]
        lack = missing(cfg, app, v, client, bucket)
        print(f"{app:6} 下载 v{v}  最新 v{a.get('latest')}  " + ("两处齐全" if not lack else "缺：" + "、".join(f"{w} {n}" for n, w in lack)))


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
    client, bucket = tos_client()
    prefix = f"site/{app}/"
    remote, token = {}, None
    while True:
        r = client.list_objects_type2(bucket, prefix=prefix, continuation_token=token, max_keys=1000)
        remote.update({o.key: o.etag.strip('"') for o in r.contents})
        if not r.is_truncated:
            break
        token = r.next_continuation_token
    local = {prefix + p.relative_to(folder).as_posix(): p
             for p in sorted(folder.rglob("*")) if p.is_file() and not p.name.startswith(".")}
    todo = [(k, p) for k, p in local.items() if remote.get(k) != md5(p)]
    dirs = {p.name for p in folder.iterdir() if p.is_dir()}
    extra = [k for k in remote if k not in local and k[len(prefix):].split("/")[0] in dirs]
    size = sum(p.stat().st_size for _, p in todo)
    print(f"==> TOS {prefix}  上传 {len(todo)} 个（{size / 1e6:.1f} MB），删除 {len(extra)} 个，未变 {len(local) - len(todo)} 个")

    def put(item):
        k, p = item
        client.upload_file(
            bucket, k, str(p),
            acl=tos.ACLType.ACL_Public_Read,
            content_type=mimetypes.guess_type(p.name)[0] or "application/octet-stream",
            cache_control="public, max-age=600",
            part_size=16 * 1024 * 1024, task_num=4, enable_checkpoint=False,
        )

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(put, todo))
        list(pool.map(lambda k: client.delete_object(bucket, k), extra))


def main():
    argv = sys.argv[1:]
    if len(argv) >= 4 and argv[0] == "publish":
        publish(argv[1], argv[2], argv[3:])
    elif len(argv) == 3 and argv[0] == "mirror":
        mirror(argv[1], argv[2])
    elif len(argv) == 3 and argv[0] == "site":
        site(argv[1], argv[2])
    elif argv[:1] == ["status"] and len(argv) <= 2:
        status(argv[1] if len(argv) == 2 else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
