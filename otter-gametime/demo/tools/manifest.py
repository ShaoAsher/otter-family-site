"""生成 assets/otter/manifest.json：校验 mockup 表情与 OT_EXPR 对齐。

改了表情后跑一次：python3 tools/manifest.py
中文名与分组直接从 v3.js 的 OT_EXPR 读（OT_EXPR 由 tools/expr_table.py 生成）；
素材从水獭家族素材库 webp/anim/270 + still/270 拷贝。
"""
import glob
import json
import os
import re

from PIL import Image

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..", "assets", "otter")
from expr_table import GROUPS as _GROUPS

GROUPS = dict(_GROUPS)


def read_expr():
    src = open(os.path.join(HERE, "..", "v3.js"), encoding="utf-8").read()
    body = src[src.index("var OT_EXPR={") :]
    body = body[: body.index("\n};")]
    return [
        (k, n, g)
        for k, n, g in re.findall(
            r"^\s*(\w+):\{n:'([^']+)'.*?g:'(\w+)'\}", body, re.M
        )
    ]


def main():
    out = {
        "spec": {
            "anim": "anim/270/<key>.webp 动图（透明 WebP 12fps）",
            "still": "still/270/<key>.webp 静帧",
            "source": "otter-family-site/otter_family（水獭家族素材库）",
        },
        "groups": GROUPS,
    }
    problems, rows = [], []
    for k, zh, g in read_expr():
        f = os.path.join(ROOT, "expr", "anim/270", k + ".webp")
        if not os.path.exists(f):
            problems.append(f"缺 expr/anim/270/{k}.webp")
            continue
        im = Image.open(f)
        still = os.path.exists(os.path.join(ROOT, "expr", "still/270", k + ".webp"))
        if not still:
            problems.append(f"缺静帧 expr/still/270/{k}.webp")
        rows.append(
            {
                "key": k,
                "name": zh,
                "group": g,
                "frames": getattr(im, "n_frames", 1),
                "size": im.size[0],
                "still": still,
            }
        )
    extra = {
        os.path.basename(p)[:-5].removesuffix("_s")
        for p in glob.glob(os.path.join(ROOT, "expr", "*.webp"))
    } - {r["key"] for r in rows}
    problems += [f"未登记 expr/{e}" for e in sorted(extra)]
    out["expr"] = rows
    out["count"] = {
        "expr": len(rows),
        **{g: sum(r["group"] == g for r in rows) for g in GROUPS},
    }
    with open(os.path.join(ROOT, "manifest.json"), "w") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=1)
    print(out["count"], "问题：" + ("；".join(problems) if problems else "无"))


if __name__ == "__main__":
    main()
