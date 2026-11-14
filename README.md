# 水獭官网

水獭家族的全部官网都在这一个仓库：家族首页、各成员的产品官网与在线试用的页面代码、三端共用的公共配置 `family.json`、发布脚本，以及家族素材库 `otter_family/` 的脚本与文档。

**仓库只放代码和文本，图片、视频、安装包都在 TOS，覆盖即生效。**

- 页面里的截图、表情、封面、宣传片写成 `data-media="shots/home-dark.webp"`，由 `shared/family.js` 拼上 `family.json` 的 `family.media`（TOS `site/<app>/`）。换素材 = 覆盖 TOS 上的文件，不用改页面、不用提交。
- 这些素材由 App 仓库的 `tool/site.sh` 生产并上传，在线试用的页面代码由它写进 `<app>/demo/`；安装包由 App 的 `tool/release.sh` 经本仓 `tool/release.py` 发到 TOS + GitHub Release。
- 素材库的大文件（图标、表情、母版视频）只在 TOS，新克隆后用 `python3 otter_family/source/sync_tos.py --pull` 拉到本地。

| 页面 | 地址 |
| --- | --- |
| 水獭家族 | **https://shaoasher.github.io/otter-family-site/** |
| 水獭 Git | https://shaoasher.github.io/otter-family-site/git/（在线试用 `git/demo/`） |
| 水獭工具 | https://shaoasher.github.io/otter-family-site/tools/（在线试用在页内 `#demo`，独立页 `tools/demo/`） |
| 水獭游时 | 暂无独立官网，家族首页 `#gametime` |
| 素材（火山引擎 TOS） | `https://otter-family-site.tos-cn-beijing.volces.com/`，目录见素材库 README「云端托管」 |

## 目录

| 路径 | 内容 |
| --- | --- |
| `index.html` | 家族首页（手写，样式、脚本内联） |
| `family.json` | **公共配置**（手写；发布脚本会切换下载版本）：版本号、版本记录、官网地址、下载版本与文件名、配色，见「公共配置」 |
| `shared/icons/` | 各成员 App 图标 + 家族剪影（= `otter_family/brand/<app>/icon.png`、`common/otter_white.png`），各页面共用 |
| `shared/otter/hi.webp` | 家族首页招呼动图（= `otter_family/webp/anim_270/hi.webp`） |
| `shared/vendor/` | GSAP 3.15.1 与 ScrollTrigger，产品官网共用（本地托管，不依赖 CDN） |
| `shared/family.js` | 产品官网共用脚本：素材地址（`data-media`）、版本号、版本记录与下载链接，国内 / 海外选下载源 |
| `<app>/index.html`、`<app>/site.js` | 产品官网页面与它自己的动效、交互（手写） |
| `<app>/demo/`、`<app>/promo.zh.vtt` | **产物**：在线试用的页面代码、宣传片字幕（字幕要和页面同域），App 仓库 `./tool/site.sh` 写入 |
| `tool/release.py` | 发布：安装包（TOS + GitHub Release）、官网素材同步到 TOS（`site`），见「安装包」「产品官网素材」 |
| `tool/shots.mjs`、`tool/stamp.py` | 截图引擎、写 `BUILD.json`，供各 App 的 `site.sh` 调用 |
| `.github/workflows/pages.yml` | 推 `main` 后把网页目录部署到 Pages |
| `otter_family/` | 家族素材库的脚本、文档、提示词（大文件在 TOS），见 [`otter_family/README.md`](otter_family/README.md) |

TOS `site/<app>/`：`promo.mp4` 宣传片、`poster.jpg` 封面、`og.jpg` 分享图、`shots/` 截图、`demo/expr/` 表情、`BUILD.json`（每类素材由 App 的哪个分支、提交、版本出的）。

## 分支与上线

只有 `main`。推上去后 GitHub Actions（`pages.yml`）把 `index.html`、`family.json`、`shared/`、`git/`、`tools/` 部署到 Pages（Settings → Pages → Source 是「GitHub Actions」）。加了新成员官网目录，要把它加进 `pages.yml`。

只换图片、视频不用推：`site.sh` 传到 TOS 就生效（缓存 10 分钟）。

## 公共配置 family.json

三个 App 和各官网共用的信息只在这里改一次。

| 发布位置 | 地址 | 谁在读 |
| --- | --- | --- |
| TOS（主） | `https://otter-family-site.tos-cn-beijing.volces.com/config/family.json` | 三个 App（国内快；不返回跨域头，网页不读它） |
| GitHub Pages（备） | `https://shaoasher.github.io/otter-family-site/family.json` | 各官网（同域名）；App 在 TOS 失败时退到这里 |

字段：

- `apps.<id>.latest` / `changelog`：最新版本与版本记录（新的在前，`zh` 必填，水獭 Git 另带 `en`）。
- `apps.<id>.download.version`：**已经能下载到的版本**，由 `tool/release.py` 在两处都上传齐后切换；App 只在这个版本比自己新时提示更新。
- `apps.<id>.download.files`：平台 → 固定文件名。官网下载按钮写平台（`data-dl="macos"`），文件名只在这里维护。
- `family.releases`：下载地址模板，`{app}` `{version}` `{file}` 替换后即直链；`page` 是 GitHub 上该版本的 Release 页（含 SHA256）。

改版本记录：在 `changelog` 最前面加一条，`latest` 改成新版本号；推到 TOS（`cd otter_family && python3 source/sync_tos.py config`），再按「分支与上线」推 `main`。App 不内置这份配置，运行时读 TOS（失败读 Pages）并缓存，这里改完不用动 App。

约定：`schema` 只在字段不兼容时加一；App 遇到更高的 `schema` 会继续用手上缓存的那份。`family.members` 里的 `{from}` 换成 App 的 `from`。

## 安装包

所有 App 的安装包都发在这里，不再分仓库：

| 位置 | 路径 | 用途 |
| --- | --- | --- |
| TOS | `release/<app>/<版本>/<文件名>`（公共读） | 国内下载（官网默认） |
| GitHub Release | 本仓，标签 `<app>-v<版本>`（如 `git-v3.0.0`），不标 latest | 海外下载；Release 说明含版本记录与 SHA256 |

官网按访客 IP 选源：查到不在中国大陆换 GitHub，查询失败或超时保持 TOS。

发版流程（以水獭 Git 为例）：

1. 在 `family.json` 的 `apps.git.changelog` 写好这一版。
2. 在 App 仓库的 `release` 分支跑 `./tool/release.sh`：打包、公证，然后调用本仓 `tool/release.py publish git <版本> 文件…` 上传到两处。
3. push App 仓库的 `release` 后，CI 构建 Windows 包并传到同一个 GitHub Release（secret `SITE_RELEASE_TOKEN` 要对本仓有 contents:write）。
4. 在本仓跑 `python3 tool/release.py mirror git <版本>`，把 Windows 包补到 TOS。两处、全平台都齐了，脚本才把 `download.version` 切到这一版并把 `family.json` 推到 TOS。
5. 提交 `family.json`，按「分支与上线」推 `main`。

`python3 tool/release.py status` 查看各 App 当前下载版本在两处是否齐全。脚本需要 `gh auth login` 和 `source ~/.config/devkeys/env.sh`（TOS_*）。

## 产品官网素材

都在 App 仓库里出，一个命令，各 App 同名同参数（先 `source ~/.config/devkeys/env.sh`）：

```bash
./tool/site.sh demo      # 在线试用：页面代码 → 本仓 <app>/demo/，表情 → TOS demo/expr/
./tool/site.sh shots     # 截图：原型按 App 的 site/shots.json 截 → TOS shots/（tool/shots.mjs，需 Chrome、cwebp）
./tool/site.sh art       # 素材图：App 的 site/og.jpg、poster.jpg → TOS；字幕 promo.zh.vtt → 本仓 <app>/
./tool/site.sh promo …   # 宣传片：压成 H.264 → TOS promo.mp4，字幕、封面更新到 App 的 site/ 再出 art
./tool/site.sh all       # demo + shots + art（水獭 Git 有默认成片时再加 promo）
```

上传走 `tool/release.py site <app> <目录>`：按 MD5 只传变化的，子目录（`shots/`、`demo/`）里远端多出来的会删掉。只有 `demo` 和字幕会改本仓文件，要提交推 `main`；其余传完即生效。

App 仓库的 `site/` 放这些素材的源：分享图 `og.jpg`（1200×630）、播放器封面 `poster.jpg`、字幕 `promo.zh.vtt`、截图清单 `shots.json`。宣传片工程各在 App 仓库（水獭 Git `promo-site/`，渲染后 `site.sh promo` 默认取 `promo-site/renders/`）。

在线试用由官网用 iframe 嵌入，通过 `postMessage({type:'otter-demo', action, value})` 控制，演示回传 `{type:'otter-demo-state', …}`。参数：`?embed` 隐藏控制台并按 iframe 缩放，`&theme=day` 浅色，`&page=…` 起始页，`&nosplash` 跳过启动动画。

## 加一个新成员

1. 在素材库生成该 App 的图标（`otter_family/source/brand_build.py`，生成后 `sync_tos.py brand` 传 TOS），拷 `brand/<app>/icon.png` 到 `shared/icons/<app>.png`。
2. 在 `index.html` 的 `.members` 里复制一张 `<article class="member">`，`id` / `data-app` 填 `<app>`，配一个 `.m-<app>` 定义 `--c` / `--c2`（圆盘渐变，见素材库「三端与配色」）。
3. 在 `family.json` 的 `apps` 里加一项；有安装包就写 `download`。
4. 要独立官网就建 `<app>/`（`index.html`、`site.js`），引用 `../shared/vendor/`、`../shared/icons/`，页尾在 `site.js` 前挂 `<script src="../shared/family.js" data-app="<app>" defer>`，图片视频用 `data-media`；把目录加进 `pages.yml`；App 仓库照水獭工具的 `tool/site.sh` 与 `site/` 配一套。
5. 首屏、标题、页脚都不写成员个数、不排成员图标，不用改。

## 从 App 跳进来

各 App 的「关于」里都有「水獭家族」入口，打开：

```
https://shaoasher.github.io/otter-family-site/?from=<app>#members
```

`from` 取成员卡的 `data-app`（目前有 `gametime` / `ottertools` / `ottergit`），页面会把对应成员卡描边，并标「你从这里来」。

## 本地预览

```bash
python3 -m http.server 8790
# http://127.0.0.1:8790/ · /git/ · /tools/（宣传片从 TOS 加载，要联网）
```
