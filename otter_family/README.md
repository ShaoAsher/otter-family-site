# 水獭家族素材库（otter_family）

新 IP 立绘落地的品牌图标与 120 枚表情（静图 + 动图）。

## 目录

```
otter_family/
├── brand/     品牌：母版 → 成品，每个文件只有一份
│   ├── master/   母版（只改这里）
│   │   ├── ip_full.png  ip_half.png   全身立绘（一切造型以此为准）/ 半身头像
│   │   ├── silhouette.png             家族剪影母版
│   │   └── <app>.png                  三端图标母版（深底方块，同一模板）
│   ├── common/   三端共用成品：otter_black / otter_white 剪影、logo_otter 分层水獭层
│   └── <app>/    git / tools / gametime 各自成品，见「品牌成品」
├── expr/      表情成品（透明 WebP，<类型>_<尺寸>/<key>.webp；App 与官网都用其中 270 档，经 TOS 表情包分发）
│   ├── still_1080/  still_540/  still_270/     静图
│   ├── anim_540/  anim_270/                    动图（12 帧/秒，4 秒循环）
│   └── manifest.json                           anim_540 清单
├── source/    原文件与脚本
│   ├── still_1024/  绿幕静图母版 <key>.jpg（1024×1024）
│   ├── video_720/   绿幕循环视频母版 <key>.mp4（720×720，4 秒，首尾帧 = 静图）
│   ├── prompt/      实际使用的静图 / 视频提示词 <key>.json
│   ├── v3_plan.json 生成规格：身份锚点、构图、每枚静图设计 s 与动作 m
│   ├── expr_keys.md 120 个 key 与中文名
│   ├── export.py    抠像导出
│   ├── brand_build.py  由 brand/master 生成 brand/common 与 brand/<app>
│   └── sync_tos.py  同步到火山引擎 TOS
└── README.md
```

每个资源只存一份。App 只拷贝成品，不在 App 仓库里放生成脚本：表情由 `sync_tos.py expr` 打成表情包、App 用 `./tool/otter assets` 拉，图标从 `brand/<app>/` 拷。

git 里只有脚本、文档、`prompt/` 与 `v3_plan.json`；`brand/`、`expr/`、`source/still_1024/`、`source/video_720/` 只在 TOS（`brand/`、`backup/expr/`、`backup/source/`），被 `.gitignore` 忽略。新克隆或换电脑后先拉下来，改完再推上去：

```bash
source ~/.config/devkeys/env.sh
python3 source/sync_tos.py --pull     # TOS → 本地（只拉缺的或不同的；git 里的脚本不覆盖）
python3 source/sync_tos.py            # 本地 → TOS（改了母版、重新导出之后）
```

## 品牌成品

三张图标母版 `master/<app>.png` 共用同一模板：深底、圆盘大小、水獭、光晕、徽章位置与大小完全一致，只换圆盘渐变（见「三端与配色」）和徽章图形；改其中一张时三张一起改，保持桌面图标风格统一。

母版改了才需要重新生成：`python3 source/brand_build.py`，之后同步 TOS 并把成品拷进各 App。

| 文件 | 规格 | 用途 |
| --- | --- | --- |
| `<app>/icon.png` | 512，正方深底（不额外切圆角） | 关于页、家族卡、官网 |
| `<app>/mark.png` | 512，透明，圆盘 + 徽章 | 启动页、页头 Logo |
| `common/logo_otter.png` + `<app>/logo_badge.png` | 512，画布 = 圆盘外接正方形，已在位 | 启动页 / 关于页分层动效：代码画渐变圆盘，再叠水獭层（墨色，可着色）、徽章层 |
| `common/otter_{black,white}.png` | 512，透明剪影 | 32px 以下的装饰小标 |
| `git/`、`tools/` 的 `macos/AppIcon.appiconset/` | 16–1024 + Contents.json | 整目录替换 `macos/Runner/Assets.xcassets/AppIcon.appiconset` |
| `git/`、`tools/` 的 `macos/MenuBarIcon.imageset/` | 18/36，模板图 | 菜单栏，系统按明暗自动着色 |
| `git/`、`tools/` 的 `windows/app_icon.ico`、`tray_icon.ico` | 多尺寸 ICO | `windows/runner/resources/app_icon.ico`、托盘 |
| `gametime/ios/AppIcon.appiconset/` | iPhone + iPad 全套 + 1024 | 整目录替换 `ios/Runner/Assets.xcassets/AppIcon.appiconset` |
| `gametime/android/res/` | 启动图标 + 自适应前景 + 背景色 | 合并进 `android/app/src/main/res/` |

```bash
LIB=~/Desktop/code/otter-family-site/otter_family
# 桌面端（以 OtterGit 为例，Tools 把 git 换成 tools）
rsync -a --delete $LIB/brand/git/macos/AppIcon.appiconset/ macos/Runner/Assets.xcassets/AppIcon.appiconset/
rsync -a --delete $LIB/brand/git/macos/MenuBarIcon.imageset/ macos/Runner/Assets.xcassets/MenuBarIcon.imageset/
cp $LIB/brand/git/windows/app_icon.ico windows/runner/resources/app_icon.ico
# 移动端
rsync -a --delete $LIB/brand/gametime/ios/AppIcon.appiconset/ ios/Runner/Assets.xcassets/AppIcon.appiconset/
rsync -a $LIB/brand/gametime/android/res/ android/app/src/main/res/
# 表情不用拷：App 里 ./tool/otter assets 按 otter.json 从 TOS 表情包拉
```

## 规格与用法

| 目录 | 格式 | 建议用途 |
| --- | --- | --- |
| `expr/still_1080/` | 透明 WebP q90 | 高清存档 / 物料 |
| `expr/still_540/` | 透明 WebP q90 | 物料、大图（不进 App） |
| `expr/still_270/` | 透明 WebP q90 | App 与官网的静帧（表情包） |
| `expr/anim_270/` | 透明动态 WebP，12fps，q70 | App 与官网的动图（表情包） |
| `expr/anim_540/` | 透明动态 WebP，12fps，q70 | 宣传片、物料（不进 App） |

`expr/manifest.json`：`{version, size, fps, items: [{key, zh, path, bytes, sha256}]}`，`path` 相对 `expr/`（export.py 生成，物料用；App 用的是 TOS 表情包里的 manifest.json）。

## 导出

```bash
python3 source/export.py [key ...]   # 抠像导出（不带 key 为全部；源文件未变的会跳过），结束后刷新 manifest
JOBS=6 python3 source/export.py      # 多进程（沙箱内需放开权限）
```

抠像：绿色优势度 `g - max(r,b)` 映射 alpha，按四角实际底色自适应阈值（兼容偏暗的绿幕），去溢色 `g ≤ max(r,b)+4`，alpha 收边 + 轻羽化。

## 云端托管（火山引擎 TOS）

```bash
source ~/.config/devkeys/env.sh       # TOS_*
python3 source/sync_tos.py            # 增量同步（按 MD5 比对，未变化的跳过）
python3 source/sync_tos.py expr       # 只同步指定部分：config / brand / expr / backup（= backup/expr + backup/source）
python3 source/sync_tos.py --dry-run  # 只看差异；--delete 删除远端多余文件；--reset-acl 重设已有对象权限
python3 source/sync_tos.py --pull     # 反过来，TOS → 本地
```

存储桶 `otter-family-site`（cn-beijing）整桶归水獭家族，按用途分目录、不加前缀，桶不可列目录。公开的放顶层，私有的全在 `backup/` 下：

| 远端目录 | 内容 | 谁写 | 权限 |
| --- | --- | --- | --- |
| `config/` | `family.json` 家族公共配置（= 仓库根目录 `family.json`，见上级 README「公共配置」）；三个 App 写死这个地址，**不要再改路径** | `sync_tos.py config`、`tool/release/release.py` 切换下载版本时 | 公开读，不缓存 |
| `release/<app>/v<版本>/` | 安装包 | `./tool/otter publish` / `mirror`（`tool/release/release.py`） | 公开读，长缓存（不可变） |
| `site/<app>/` | 官网素材：`promo.mp4`、`poster.jpg`、`og.jpg`、`shots/`、`build.json`（出处） | `tool/release/release.py site`（App 的 `./tool/otter site`） | 公开读，缓存 1 小时 |
| `brand/` | 图标母版与各 App 成品 | `sync_tos.py brand` | 公开读 |
| `expr/<版本>/` | App 与官网共用的 270 档表情包：`anim_270/`、`still_270/` + `manifest.json`，版本 `v1`、`v2`…（当前 `v3`）；同一版本发布后不再改，换代加新版本 | `sync_tos.py expr`（版本见 `EXPR_VERSION`） | 公开读 |
| `backup/expr/` | 表情成品全档位备份（= 本地 `expr/`） | `sync_tos.py backup` | 私有，低频存储 |
| `backup/source/` | 母版备份（= 本地 `source/still_1024/`、`source/video_720/`；git 里有的脚本、提示词不备份） | `sync_tos.py backup` | 私有，低频存储 |

公开地址前缀 `https://otter-family-site.tos-cn-beijing.volces.com/`：

- 品牌图：`brand/<app>/icon.png`、`brand/<app>/mark.png`、`brand/common/otter_white.png` 等（App 的家族入口、官网直接引用，不用把兄弟 App 的图标打进包）
- 表情：`expr/<版本>/anim_270/<名>.webp`（动图）、`still_270/<名>.webp`（静帧）、`manifest.json`（每个文件的 md5 与大小）。三个 App 构建前用 `./tool/otter assets`（上级仓 `tool/app/assets.py`）按各自 `otter.json` 原样拉到 `assets/otter/expr/anim_270/`、`still_270/`；官网页面（`data-expr`）与在线试用直接引用这一份。全档位（含 540、1080）只在私有的 `backup/expr/`。

## 三端与配色

| 成员 | app 标识 | 主渐变 | 产品徽章 |
| --- | --- | --- | --- |
| 水獭游时 GameTime | `gametime` | 磁青 `#1FB6FF → #5CF2DE` | 游戏手柄 |
| 水獭工具 Tools | `tools` | 獭橙 `#FA5A1E → #FFB04A` | 扳手 |
| 水獭 Git | `git` | 琥珀金 `#E89B0C → #FFD66B` | 分支节点 |

家族主色：藏蓝 `#1B2A4A`、冰蓝 `#5CF2DE`、暖金 `#D9A441`。

## 身份锚点（以 `brand/master/ip_full.png` 为准）

藏蓝色直长发带侧发、深棕圆水獭耳、左侧金月牙发夹（小蓝宝石 + 细金链）、脑后淡金半透明月环、两侧悬浮冰蓝晶片、蓝宝石耳坠、颈间冰蓝水流围巾与水滴坠、藏蓝露肩短披肩（金边暗纹）、白色半透明泡泡袖、藏蓝金边束身马甲、领口金框蓝宝石胸针（蓝流苏）与腰间金色太阳形蓝宝石扣、白色半透明长手套、白色层叠短裙 + 藏蓝/浅蓝薄纱外摆、白色金边蓝宝石短靴、棕色水獭尾。无麻花辫、无蝴蝶结、无额外饰品。

表情默认上半身构图；`solo`（侧身抱膝）与 `stroll`（散步）为全身，下半身严格按立绘。
