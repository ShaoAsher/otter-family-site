#!/usr/bin/env python3
"""CI 把 Windows 包传到本仓的 GitHub Release（标签 <app>-v<版本>），只需要 gh 与 GH_TOKEN，不碰 TOS。

  python3 tool/ci_upload.py <app> <版本> <文件> [文件 ...]

Release 不存在就建（不标 latest，说明留给 macOS 发布脚本补）；已存在就 --clobber 覆盖同名文件。
传完在本机跑 tool/release.py mirror <app> <版本> 补到 TOS 并切换下载版本。
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "ShaoAsher/otter-family-site"


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    app, version, files = argv[0], argv[1].split("+")[0], argv[2:]
    name = json.loads((ROOT / "family.json").read_text(encoding="utf-8"))["apps"][app]["name"]
    tag = f"{app}-v{version}"
    for f in files:
        if not Path(f).is_file():
            sys.exit(f"找不到 {f}")
    if subprocess.run(["gh", "release", "view", tag, "--repo", REPO], capture_output=True).returncode != 0:
        cmd = ["gh", "release", "create", tag, *files, "--repo", REPO, "--title", f"{name} {version}",
               "--notes", f"{name} {version}（Windows 包由 CI 上传，macOS 包与说明由发布脚本补上）", "--latest=false"]
    else:
        cmd = ["gh", "release", "upload", tag, *files, "--repo", REPO, "--clobber"]
    subprocess.run(cmd, check=True)
    print(f"已上传 {tag}：" + "、".join(Path(f).name for f in files))


if __name__ == "__main__":
    main(sys.argv[1:])
