#!/usr/bin/env python3
"""把 otter_family 增量同步到火山引擎 TOS。

  source ~/.config/devkeys/env.sh   # 提供 TOS_AK / TOS_SK / TOS_BUCKET / TOS_REGION / TOS_ENDPOINT
  python3 source/sync_tos.py              # 全部同步
  python3 source/sync_tos.py expr         # 只同步指定部分：config / brand / expr / backup（= backup/expr + backup/source）
  python3 source/sync_tos.py --dry-run    # 只列出将要上传/删除的文件
  python3 source/sync_tos.py --delete     # 同时删除远端多余文件
  python3 source/sync_tos.py --reset-acl  # 按当前规则重设远端已有对象的读写权限
  python3 source/sync_tos.py --pull       # 反过来：把 brand/、backup/ 拉到本地（新克隆后先跑这个）

大文件（brand/、expr/、source/still_1024、source/video_720）不进 git，只在 TOS；git 里只有脚本、文档与提示词。

远端布局（桶根目录，无前缀；release/、site/ 由 tool/release/release.py 管，这里不碰）：
  config/        公开读、不缓存，family.json = 仓库根目录的家族公共配置（版本记录、官网地址等，三端与官网共用）
  brand/         公开读，图标母版与各 App 成品（App 家族入口、官网直接引用）
  expr/<版本>/   公开读，App 与官网共用的 270 档表情包（明文）：anim_270/<key>.webp 动图 + still_270/<key>.webp 静帧
                 + manifest.json（md5）。App 构建前由 tool/app/assets.py 按 otter.json 的 expr.version 拉取，官网页面与在线试用直接引用；
                 版本号 v1、v2…，同一版本发布后不再改，表情集换代就加新版本（EXPR_VERSION），旧版本留着给老版本构建。
  backup/expr/   私有，低频存储（本地 expr/：表情成品全档位）
  backup/source/ 私有，低频存储（本地 source/ 里不在 git 的：still_1024/、video_720/ 母版）

按 MD5 与远端 ETag 比对，未变化的文件不重复上传。
"""
import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor

warnings.filterwarnings("ignore")
import tos  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {".DS_Store", "__pycache__"}
# 远端目录 -> (本地目录, 是否公开, 存储类型)
PARTS = {
    "config": ("../family.json", True, tos.StorageClassType.Storage_Class_Standard),
    "brand": ("brand", True, tos.StorageClassType.Storage_Class_Standard),
    "backup/expr": ("expr", False, tos.StorageClassType.Storage_Class_Ia),
    "backup/source": ("source", False, tos.StorageClassType.Storage_Class_Ia),
}
EXPR_VERSION = "v3"
# 表情包：远端目录 -> 带进包里的本地 expr/ 子目录（按 类型_尺寸 命名，App 里 assets/otter/expr/ 下同名）
BUNDLES = {f"expr/{EXPR_VERSION}": ["anim_270", "still_270"]}
PARTS.update({k: (None, True, tos.StorageClassType.Storage_Class_Standard) for k in BUNDLES})

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/json", ".json")


def bundle_items(part):
    files = {}
    for sub in BUNDLES[part]:
        for name in sorted(os.listdir(f"{ROOT}/expr/{sub}")):
            if name.endswith(".webp"):
                files[f"{sub}/{name}"] = f"{ROOT}/expr/{sub}/{name}"
    manifest = {"version": part.rsplit("/", 1)[1], "files": {}}
    for name, path in sorted(files.items()):
        data = open(path, "rb").read()
        manifest["files"][name] = {"md5": hashlib.md5(data).hexdigest(), "bytes": len(data)}
        yield f"{part}/{name}", path, lambda p=path: open(p, "rb").read()
    body = json.dumps(manifest, ensure_ascii=False, indent=1).encode()
    yield f"{part}/manifest.json", None, lambda: body


def local_items(part):
    """产出 (远端 key, 本地路径, 取内容函数)。git 里跟踪的文件（脚本、文档、提示词）不传。"""
    if part in BUNDLES:
        yield from bundle_items(part)
        return
    src = PARTS[part][0]
    if os.path.isfile(f"{ROOT}/{src}"):
        path = os.path.normpath(f"{ROOT}/{src}")
        yield f"{part}/{os.path.basename(path)}", path, lambda: open(path, "rb").read()
        return
    for d, dirs, files in os.walk(f"{ROOT}/{src}"):
        dirs[:] = [x for x in dirs if x not in SKIP]
        for name in files:
            if name in SKIP or name.startswith("."):
                continue
            path = f"{d}/{name}"
            rel = os.path.relpath(path, f"{ROOT}/{src}")
            if os.path.relpath(path, ROOT) in TRACKED:
                continue
            yield f"{part}/{rel}", path, lambda p=path: open(p, "rb").read()


TRACKED = set(subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split())


def remote_etags(client, bucket, part):
    out, token = {}, None
    while True:
        r = client.list_objects_type2(bucket, prefix=f"{part}/", continuation_token=token, list_only_once=True)
        for o in r.contents:
            out[o.key] = o.etag.strip('"')
        if not r.is_truncated:
            return out
        token = r.next_continuation_token


def pull(client, bucket, parts):
    """TOS → 本地：只拉缺的或内容不同的；git 里跟踪的文件（脚本、文档）以本地为准，不覆盖。"""
    todo = []
    for part in parts:
        src = PARTS[part][0]
        if src is None or os.path.isfile(f"{ROOT}/{src}"):
            continue
        for k, etag in remote_etags(client, bucket, part).items():
            rel = os.path.join(src, k[len(part) + 1:])
            path = f"{ROOT}/{rel}"
            if rel in TRACKED:
                continue
            if os.path.isfile(path) and hashlib.md5(open(path, "rb").read()).hexdigest() == etag:
                continue
            todo.append((k, path))
    print(f"待下载 {len(todo)} 个")

    def get(item):
        k, path = item
        os.makedirs(os.path.dirname(path), exist_ok=True)
        client.get_object_to_file(bucket, k, path)

    with ThreadPoolExecutor(int(os.environ.get("JOBS", 8))) as pool:
        list(pool.map(get, todo))
    print(f"已下载到 {ROOT}")


def put_args(part, key):
    _, public, storage = PARTS[part]
    if key.endswith(".json"):
        ctype = "application/json"
    else:
        ctype = mimetypes.guess_type(key)[0] or "application/octet-stream"
    args = {
        "content_type": ctype,
        "acl": tos.ACLType.ACL_Public_Read if public else tos.ACLType.ACL_Private,
        "storage_class": storage,
    }
    if public:
        args["cache_control"] = "no-cache" if key.endswith(".json") else "public, max-age=86400"
    return args


def main():
    argv = sys.argv[1:]
    dry, delete, reset_acl = "--dry-run" in argv, "--delete" in argv, "--reset-acl" in argv
    picks = [a.strip("/") for a in argv if not a.startswith("--")]
    parts = [p for p in PARTS if not picks or any(p == a or p.startswith(a + "/") for a in picks)]
    bad = [a for a in picks if not any(p == a or p.startswith(a + "/") for p in PARTS)]
    if bad:
        sys.exit(f"未知目录 {bad}，可选：{list(PARTS)} 或 backup")
    names = ("TOS_AK", "TOS_SK", "TOS_BUCKET", "TOS_REGION", "TOS_ENDPOINT")
    env = {k: os.environ.get(k) for k in names}
    if not all(env.values()):
        sys.exit("缺少 TOS_* 环境变量，先执行 source ~/.config/devkeys/env.sh")
    client = tos.TosClientV2(env["TOS_AK"], env["TOS_SK"], env["TOS_ENDPOINT"], env["TOS_REGION"])
    bucket = env["TOS_BUCKET"]
    if "--pull" in argv:
        return pull(client, bucket, parts)

    todo, keep, extra, total = [], [], [], 0
    for part in parts:
        remote = remote_etags(client, bucket, part)
        seen = set()
        for k, path, load in local_items(part):
            seen.add(k)
            data = load()
            if remote.get(k) != hashlib.md5(data).hexdigest():
                todo.append((part, k, data))
                total += len(data)
            else:
                keep.append((part, k))
        extra += sorted(set(remote) - seen)

    print(f"待上传 {len(todo)} 个（{total / 1e6:.1f} MB），远端多余 {len(extra)} 个")
    if dry:
        for _, k, _ in todo:
            print("  +", k)
        for k in extra:
            print("  -", k)
        return

    done = [0]

    def put(item):
        part, k, data = item
        client.put_object(bucket, k, content=data, **put_args(part, k))
        done[0] += 1
        if done[0] % 50 == 0 or done[0] == len(todo):
            print(f"  已上传 {done[0]}/{len(todo)}", flush=True)

    def fix_acl(item):
        part, k = item
        client.put_object_acl(bucket, k, acl=put_args(part, k)["acl"])

    jobs = int(os.environ.get("JOBS", 8))
    with ThreadPoolExecutor(jobs) as pool:
        list(pool.map(put, todo))
        if reset_acl:
            list(pool.map(fix_acl, keep))
            print(f"已重设 {len(keep)} 个已有对象的读写权限")

    if delete:
        for k in extra:
            client.delete_object(bucket, k)
        print(f"已删除远端多余 {len(extra)} 个")
    elif extra:
        print("远端多余文件未删除，需要时加 --delete")

    print(f"表情包清单：https://{bucket}.{env['TOS_ENDPOINT']}/expr/{EXPR_VERSION}/manifest.json")


if __name__ == "__main__":
    main()
