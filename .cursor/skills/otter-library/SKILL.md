---
name: otter-library
description: >-
  水獭家族真相源：library/ 单根；private 母版（三档+源片）与 latest 对外资源分离。
---

# 真相源

```text
library/
  private/     母版：master、source/still、source/video(720mp4)、expr 三档(1080/540/270)
  latest/      对外：common、otter-*、以及 expr/*/270 交付档
  keep/vX/     确认留下的旧公开文件
  release/…
  current.json
  family.json
```

本地 `otter-library/`：`source/still` + `source/video`；`expr/still|anim`。`lib export`：video→anim。

公开不要放 1080/540 母版或 720 mp4。App/官网只读 `latest/`。片子经 `film ingest` 写入 `otter-*/`，再 `lib publish`。
