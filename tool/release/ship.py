#!/usr/bin/env python3
"""一条命令发版：在 App 的 release 分支上，从检查到切换下载版本、写回 family.json。

  ./tool/otter ship [--skip-build] [--use-dist] [--no-wait] [--push]      （在 App 根目录）
  python3 tool/release/ship.py <App 根目录> [同上]                        （直接调用）

1. 检查：App 的 otter.json、pubspec 版本；family.json 的 changelog 最前面是这一版（没写就停）。
2. tool/app/release.sh（release 分支检查、打包公证、release.py publish 传 TOS + GitHub）。
3. 等 Windows CI 把包传到 GitHub Release（每 30 秒查一次，最多 60 分钟；--no-wait 跳过，之后自己跑 mirror）。
4. release.py mirror：Windows 包补到 TOS；全平台两处齐了就切换 download.version，family.json 推到 TOS。
5. 本仓提交 family.json；带 --push 时推 main（Pages 上的 family.json 与产品官网随之更新）。

需要 gh auth login 与 source ~/.config/devkeys/env.sh（TOS_*）。
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "family.json"
REPO = "ShaoAsher/otter-family-site"
WAIT_MIN = 60


def run(*cmd, cwd=None):
    print("==> " + " ".join(map(str, cmd)))
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True)


def gh_assets(tag):
    r = subprocess.run(["gh", "release", "view", tag, "--repo", REPO, "--json", "assets"], capture_output=True, text=True)
    return {a["name"] for a in json.loads(r.stdout)["assets"]} if r.returncode == 0 else set()


def main(argv):
    flags = {a for a in argv if a.startswith("--")}
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 1 or flags - {"--skip-build", "--use-dist", "--no-wait", "--push"}:
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

    run("bash", ROOT / "tool/app/release.sh", *sorted(flags & {"--skip-build", "--use-dist"}), cwd=app_root)

    tag = f"{app}-v{version}"
    win = {n for k, n in a["download"]["files"].items() if k.startswith("windows")}
    if win and "--no-wait" not in flags:
        print(f"==> 等 Windows CI 把 {'、'.join(sorted(win))} 传到 {tag}（最多 {WAIT_MIN} 分钟）")
        deadline = time.time() + WAIT_MIN * 60
        while not win <= gh_assets(tag):
            if time.time() > deadline:
                sys.exit(f"等不到 Windows 包；CI 好了以后跑：./tool/otter mirror {app} {version}")
            time.sleep(30)
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


if __name__ == "__main__":
    main(sys.argv[1:])
