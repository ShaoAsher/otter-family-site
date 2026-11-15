# 依赖与真相源

| 层 | 位置 |
|----|------|
| 远端真相 | TOS `library/objects/` + `versions/vX/manifest.json` + `current/` |
| 本地真相 | `otter-family-site/otter_family/library/`（gitignore） |
| 仓库 | 代码、`family.json`、提示词、脚本 |
| App 缓存 | `assets/brand`、`assets/otter/expr`（gitignore，`assets pull`） |

流水线：[`FLOW.md`](FLOW.md)。发版：[`RELEASE.md`](RELEASE.md)。
