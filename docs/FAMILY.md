# 水獭家族：架构 · 素材 · 发版

家族唯一说明。Agent 入口：`.cursor/skills/otter-library/SKILL.md`（指向本文）。

## 仓库

| 仓 | 职责 | 文档放哪 |
|----|------|----------|
| `otter-library/` | 素材真相，与 OSS 同构 | 本仓 `README.md`（路径）+ 本文（流程） |
| `otter-site/` | CLI、`family.json`、`otter_kit`、官网 | **本文** + `tool/expr_keys.md` |
| `otter-git` / `otter-tools` | 桌面 App | 各仓 `README.md`（怎么跑 / 发版） |
| `otter-gametime` | 移动 App | `README.md` + `store/`（上架文案，不进包） |
| `otter-films/` | 片子工程 | 各片子目录 `SPEC.md` / `README.md` |

**原则**：家族流程与路径只维护本文；进安装包的说明写在 App 仓；不进包的素材只在 `otter-library` / OSS。

## 本地 ↔ OSS（同构，无 `latest/`）

```
otter-library/{expr,common,catalog,otter-*}/  ↔  library/{same}/
otter-library/private/                        ↔  library/private/
```

| 区 | 路径 | 说明 |
|----|------|------|
| 公用 | `expr/{still,anim}/{270,540}` · `common` · `catalog` | 家族共用 |
| App | `{app}/`（icon · splash · shots · macos/windows/ios/android · games/ai/store…） | 按项目分 |
| 母版 | `private/master` · `private/source` · `private/expr`（含 1080） | 仅发版机 |
| 安装包 | `library/release/{app}/v{ver}/` | 只留当前 download 版 |

同内容**硬链**，禁止再拷一份。不保留旧 `library/latest/` 或类型顶栏 `brand|media|badges|…`。

### 版本字段（勿混）

| 字段 | 含义 | 谁涨 |
|------|------|------|
| `family.libraryVersion` | 与家族主版本对齐 | `lib publish --version` |
| `family.libraryBuild` | 仅 OSS/素材树世代 | `lib publish --bump` |
| App `pubspec` | 安装包 version+build | `ship` / 商店发版 |

展示 `3.2.0+N` 里加号后是 **libraryBuild**，不是 App `+N`。

## CLI（在 otter-site 或 App 内 `./tool/otter`）

```bash
./tool/otter check              # 契约
./tool/otter check .            # 再查当前 App（瘦包无 anim）

./tool/otter lib pull           # OSS → 本地 library
./tool/otter lib brand          # private/master → {app}/ + common/
./tool/otter lib export         # source → private/expr，270/540 硬链到 expr/
./tool/otter lib publish --bump --keep-none --notes "…"

./tool/otter assets             # 默认：brand + still/270（进包）
./tool/otter assets pull expr full   # 仅开发预览才拉 anim 进工程

./tool/otter ship --no-wait --push
./tool/otter mirror <app> <ver>
./tool/otter status <app>
./tool/otter film pull|ingest <app>
```

脚本对照：`sync_oss.py` · `app/assets.py` · `release/ship.py` · `release/release.py` · `check.py`。

代理：`NO_PROXY` 含 `.aliyuncs.com`。

## 表情契约

钥匙清单：`tool/expr_keys.md`。

1. 改清单 + `private/source`
2. `lib export` → `lib publish`
3. 各 App：`./tool/otter assets`
4. `./tool/otter check` / `check .`
5. 若改路径布局：升 `otter_kit` tag → 三端 `pubspec` ref

| 用途 | 路径 |
|------|------|
| 包内静帧 | `assets/otter/expr/still/270/<key>.webp` |
| OSS 动图 | `library/expr/anim/{270\|540}/` |
| 游时徽章 | `library/otter-gametime/badges/`（包内同步一份） |

禁止：`still_270` · `anim_270` · `expr/v3/` · `config/family.json` · 工程内长期堆 `anim/` · `library/latest/`。

## 发版

**桌面（Git / Tools）**

```bash
./tool/otter check
cd ../otter-git && ./tool/otter assets && ./tool/otter ship --no-wait --push
# Win 齐后：./tool/otter mirror otter-git <版本>
```

**游时**：App Store / Play；商店图在 `otter-library/otter-gametime/store/`，文案在 App 仓 `store/`。

**官网**：Pages 读 `family.json`；素材 `data-brand` / `data-media` / `data-expr` 走 `shared/family.js`。

## 官网 family.js

- `data-media` → `family.media`（`…/library/{app}/`）；含 `shots/…`、`promo.mp4` 等
- `data-brand` → `family.brand`（`…/library/`），值如 `otter-git/icon.png`
- `data-expr` → `family.expr`
- 国内下载 OSS，海外 GitHub Release

## 不要做

- 用 Git 管母版大文件
- 不进包的资源丢进 App 工程目录
- 同内容再拷一份（应用硬链）
- 只改 App 资源路径不升 kit
- Windows CI 里 `ci_upload.py git`（必须 `otter-git`）
- 保留或兼容 `library/latest/` / 旧类型顶栏
