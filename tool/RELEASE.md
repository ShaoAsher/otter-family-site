# 水獭家族发版命名与流程

## 命名（全链路统一）

| 对象 | 格式 | 示例 |
| --- | --- | --- |
| App `pubspec` 版本 | `<major>.<minor>.<patch>+<build>` | `3.0.0+19` |
| App 仓库 git 标签 | `v<版本>`（须落在 `main` 分支 HEAD，除非 `OTTER_RELEASE_ANY_BRANCH=1`） | `v3.0.0` |
| 家族仓 GitHub Release | `<app>-v<版本>` | `git-v3.0.0` |
| TOS 安装包 | `release/<app>/v<版本>/<固定文件名>` | `release/git/v3.0.0/OtterGit-macos-arm64.dmg` |
| 本地 dist（带时间戳） | `<file>-<版本>-<平台>-<YYYYMMDD-HHMM>.<ext>` | `OtterGit-3.0.0-macos-arm64-20261115-0105.dmg` |
| 上传用固定名 | `family.json` → `apps.<app>.download.files` | `OtterGit-macos-arm64.dmg` |
| TOS 品牌公开图 | `brand/<app>/icon.png` 等 | 见 `brand/index.json` |
| TOS 表情包 | `expr/<版本>/anim_270/<key>.webp` | 当前 `v3` |

`<file>` = 各 App `otter.json` 的 `package.file`（`OtterGit` / `OtterTools`）。

分支约定见 [`tool/BRANCHES.md`](BRANCHES.md)。

## 一键入口

```bash
cd otter-family-site
source ~/.config/devkeys/env.sh

./tool/otter launch scan          # 预检 + status，不发包
./tool/otter launch sync          # 品牌公开层上传 TOS（删远端多余平台套件）
./tool/otter launch git --push    # ship 水獭 Git 一条龙并推 family.json → main
./tool/otter launch all --push    # Git + 工具依次发版
```

App 目录默认 `../otter-git`、`../otter-tools`；自定义：

```bash
export OTTER_APPS='git=/path/otter-git:tools=/path/otter-tools'
```

## 标准发版顺序（桌面端）

1. `family.json`：`changelog` 首条 = `pubspec` 版本；必要时改 `latest`。
2. 图标 / 表情：`brand_build` → `sync_tos brand`；App 内 `./tool/otter assets pull`。
3. `./tool/otter site all`（各 App）→ 官网素材上 TOS `site/<app>/`。
4. App 在 **`main`** 提交；`git tag v<版本>` 指向当前提交（或 `OTTER_RELEASE_ANY_BRANCH=1` 自测）。
5. **`./tool/otter launch git --push`**：`main` 若领先则先 `push origin main`（触发 Windows CI）→ mac 打包公证 → `publish` → 等 CI → `mirror` → 切换 `download.version` → 提交并推 `family.json`。

## 仓库与 TOS 减重约定

| 资源 | 权威来源 | App 仓库 |
| --- | --- | --- |
| 表情包 | TOS `expr/v3/` | `assets/otter/expr/` **不入 git**，构建前 `assets pull` |
| 品牌公开图 | TOS `brand/` 仅 icon/mark/master/common | 平台 AppIcon 等 **只拷本机**，不上 TOS |
| 安装包 | TOS `release/` + GitHub Release | `dist/` 不提交 |
| 官网媒体 | TOS `site/` | 家族仓只保留 HTML/JS |