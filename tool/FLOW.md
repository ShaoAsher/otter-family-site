# 水獭家族流水线（定稿 → 发布）

本地真相目录（唯一大文件工作副本，不进 git）：

```text
otter-family-site/otter_family/library/
  brand/     master + 生成成品 + 平台套件
  expr/      still_* / anim_*
  source/    still_1024 / video_720（母图）
  site/      可选：官网媒体工作副本
```

TOS（真相源远端）：

```text
library/objects/<sha…>              # 去重对象（只上传新内容）
library/versions/vX.Y.Z/manifest.json
library/current/{brand,expr,site}/  # 官网/拉取用的最新公开树
library/current.json
```

只改了部分文件时：`library publish --bump` **只上传新 sha 对象**，manifest 记录全量 path→sha；`current/` 只覆盖变更文件。不需要每次全量备份。

## 六段流程

| 阶段 | 做什么 | 命令 / 位置 |
|------|--------|-------------|
| 1 定稿 | 改母版剪影、表情绿幕、品牌色 | 编辑 `library/brand/master`、`library/source`；`brand_build.py` / `export.py` |
| 2 App 原型 | mockup HTML | 各 App `docs/mockup/` |
| 3 App 源码 | 拉素材进包，写功能 | `./tool/otter assets pull` → 改 Dart |
| 4 视频 | 工厂片子 | `otter-factory`；`tool/library_pull.sh` 取 brand/expr |
| 5 官网 | 页面 + TOS 媒体 | 家族仓 HTML；`./tool/otter site …` → `library/current/site/<app>/` |
| 6 发布 | 钉版本 + 安装包 | `library publish --bump` → 提交 `family.json` → `package` / `ship` |

## 发布素材（增量）

```bash
source ~/.config/devkeys/env.sh
cd otter-family-site/otter_family
python3 source/sync_tos.py library publish --bump --notes "只改了 git 图标"
# → 新 libraryVersion；未改文件的对象不重传
```

## 发 App

```bash
cd ../otter-git
./tool/otter assets pull
./tool/otter package --notarize && ./tool/otter release --use-dist
```
