# 本地真相 + 脚本

```text
otter_family/
  library/     # 本地真相（gitignore）= TOS library 工作副本
    brand/ expr/ source/ site/
  source/      # 进 git：sync_tos / brand_build / export / prompt
```

```bash
source ~/.config/devkeys/env.sh
python3 source/sync_tos.py library pull              # TOS → library/
python3 source/brand_build.py                        # 改 master 后
python3 source/sync_tos.py library publish --bump --notes "…"
# 只上传变更对象；versions/vX/manifest 记录全量 path→sha；current/ 增量覆盖
```

流程见 [`../tool/FLOW.md`](../tool/FLOW.md)。
