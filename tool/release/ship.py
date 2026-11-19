#!/usr/bin/env python3
"""一条命令发版：在 App 的 main 分支上，从检查到切换下载版本、写回 family.json。

  ./tool/otter ship [--skip-build] [--use-dist] [--no-wait] [--push]
                    [--no-notarize] [--zip-only] [--no-push-main]     （在 App 根目录）
  python3 tool/release/ship.py <App 根目录> [同上]                        （直接调用）

1. 检查：版本、changelog、gh/OSS；可选先 push Codeup main（Windows CI 暂可跳过）。
2. tool/app/release.sh（打包公证、release.py publish → OSS + 官网仓 GitHub Release）。
3. 等 Windows 包到官网仓 Release（--no-wait 可跳过；Win 未就绪时不切换 download.version）。
4. release.py mirror：Windows 包补到 OSS；全平台齐了就切换 download.version，family.json 推 OSS。
5. 官网仓提交 family.json；带 --push 时推 main（Pages 更新）。

需要 gh auth login；OSS 读 ~/.config/devkeys/config.json 的 oss 段。
旧火山 TOS 仅存档，本流程不再访问。
"""

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "family.json"
REPO = "ShaoAsher/otter-family-site"
WAIT_MIN = 35
POLL_SEC = 12


def run(*cmd, cwd=None):
    print("==> " + " ".join(map(str, cmd)))
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True)


def gh_assets(tag):
    r = subprocess.run(["gh", "release", "view", tag, "--repo", REPO, "--json", "assets"], capture_output=True, text=True)
    return {a["name"] for a in json.loads(r.stdout)["assets"]} if r.returncode == 0 else set()


ALLOWED = {
    "--skip-build", "--use-dist", "--no-wait", "--push",
    "--no-notarize", "--zip-only", "--no-push-main", "--no-push-release",
}


def main(argv):
    flags = {a for a in argv if a.startswith("--")}
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1 or flags - ALLOWED:
        sys.exit(__doc__)
    app_root = Path(args[0]).resolve()
    app = json.loads((app_root / "otter.json").read_text(encoding="utf-8"))["id"]
    version = re.search(r"^version:\s*([0-9.]+)", (app_root / "pubspec.yaml").read_text(), re.M).group(1)

    a = json.loads(CONFIG.read_text(encoding="utf-8"))["apps"].get(app) or {}
    if not a.get("download"):
        sys.exit(f"family.json 里 {app} 没有 download，不走安装包发布")
    log = a.get("changelog") or [{}]
    if log[0].get("version") != version:
        sys.exit(f"family.json 的 apps.{app}.changelog 最前面不是 {version}，先写好这一版的更新说明")
    print(f"发版 {a['name']} {version}（{app_root}）")

    if subprocess.run(["gh", "auth", "status", "-h", "github.com"], capture_output=True).returncode:
        sys.exit("请先 gh auth login")
    sys.path.insert(0, str(ROOT / "tool"))
    try:
        import oss_store

        oss_store.bucket()
    except Exception as e:
        sys.exit(f"OSS 不可用：{e}（检查 ~/.config/devkeys/config.json 的 oss）")

    # OSS / 阿里云走直连，其余可走本机代理
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    if ".aliyuncs.com" not in no_proxy:
        merged = ",".join(
            x
            for x in (
                no_proxy,
                "localhost,127.0.0.1,::1,.local,.aliyuncs.com,otter-cn-hangzhou.devops.aliyuncs.com",
            )
            if x
        )
        os.environ["NO_PROXY"] = merged
        os.environ["no_proxy"] = merged
        print(f"==> NO_PROXY={merged}")

    check = subprocess.run([sys.executable, str(ROOT / "tool/check.py"), str(app_root)])
    if check.returncode:
        sys.exit("otter check 未通过，修好再发版")

    release_flags = sorted(flags & {"--skip-build", "--use-dist", "--no-notarize", "--zip-only"})
    if "--no-push-main" not in flags and "--no-push-release" not in flags:
        ahead = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            cwd=app_root, capture_output=True, text=True,
        )
        if ahead.returncode == 0 and ahead.stdout.strip() not in ("", "0"):
            run("git", "push", "origin", "main", cwd=app_root)

    run("bash", ROOT / "tool/app/release.sh", *release_flags, cwd=app_root)

    tag = f"{app}-v{version}"
    win = {n for k, n in a["download"]["files"].items() if k.startswith("windows")}
    if win and "--no-wait" not in flags:
        print(f"==> 等 Windows CI 把 {'、'.join(sorted(win))} 传到 {tag}（最多 {WAIT_MIN} 分钟）")
        deadline = time.time() + WAIT_MIN * 60
        while not win <= gh_assets(tag):
            if time.time() > deadline:
                sys.exit(f"等不到 Windows 包；CI 好了以后跑：./tool/otter mirror {app} {version}")
            time.sleep(POLL_SEC)
    if win and "--no-wait" in flags:
        print(f"跳过等待；Windows 包传完后跑：./tool/otter mirror {app} {version}")
    else:
        run(sys.executable, ROOT / "tool/release/release.py", "mirror", app, version)

    if subprocess.run(["git", "diff", "--quiet", "--", "family.json"], cwd=ROOT).returncode:
        run("git", "commit", "-m", f"release: {app} {version}", "--", "family.json", cwd=ROOT)
        if "--push" in flags:
            run("git", "push", "origin", "main", cwd=ROOT)
        else:
            print("family.json 已提交，推 main 后 Pages 才更新：git push origin main")

    run(sys.executable, ROOT / "tool/release/release.py", "status", app, cwd=ROOT)


if __name__ == "__main__":
    main(sys.argv[1:])
