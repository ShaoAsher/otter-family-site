# 水獭家族流水线（定稿 → 发布）

版本号与产品一致，当前 **3.0.0**（`family.libraryVersion` = 各 App `latest` 同代）。

## TOS 里有什么

```text
library/
  objects/<sha前2位>/<sha256>     ← 「obj」= 按文件内容存的二进制，同内容只存一份
  versions/v3.0.0/manifest.json   ← 这一版「路径 → sha」清单（溯源）
  versions/v3.0.1/manifest.json   ← 下一版完整清单；未改文件的 sha 与上一版相同
  current/{brand,expr,site}/      ← 对外最新可读树（官网 URL）
  current.json                    ← 当前版本指针

release/<app>/v3.0.0/             ← 安装包（按 App，与 library 同代版本号）
config/family.json
```

### objects 是什么

每个文件算一次 SHA-256，存到 `objects/…/该哈希`。  
**改名、多版本引用同一内容 → 不重传、不占第二份。**  
manifest 只记「逻辑路径对应哪个哈希」，所以：

| 动作 | 实际上传 |
|------|----------|
| 第一次发 3.0.0 | 全量对象（只此一次） |
| 只改一张 icon 发 3.0.1 | **只上传那 1 个新对象** + 一份新 manifest；其余路径仍指向旧 sha |
| 把 1.1.0 改标成 3.0.0 | 对象已存在 → **上传 0**（已验证） |

溯源：打开 `versions/v3.0.0/manifest.json`，任一路径都能对上 `objects/` 里的唯一文件。

### 本地

`otter_family/library/` = **最新全量**工作副本（brand + expr + source 母版 + site），gitignore。  
`library pull` 按当前 manifest 从 objects 还原；日常改完再 `publish`。

## 六段流程

| 阶段 | 做什么 | 位置 |
|------|--------|------|
| 1 定稿 | 母版 / 表情绿幕 / 品牌色 | `library/brand/master`、`library/source` → `brand_build` / `export` |
| 2 App 原型 | mockup | 各 App `docs/mockup/` |
| 3 App 源码 | 拉素材 + 写功能 | `./tool/otter assets pull` |
| 4 视频 | 工厂 | `otter-factory` + `tool/library_pull.sh` |
| 5 官网 | 页面 + 媒体 | HTML；`./tool/otter site` → `library/current/site/` |
| 6 发布 | 钉 3.0.x + 安装包 | `library publish --bump` → `package` / `ship` → `release/<app>/v3.0.x/` |

## 发素材（增量）

```bash
cd otter-family-site/otter_family
# 本地 library/ 已是全量最新
python3 source/sync_tos.py library publish --bump --notes "只改了 git icon"
# → libraryVersion 3.0.1；只传变更对象；current/ 只覆盖变更文件
```

官网始终读 `library/current/…`。  
App 打包钉 `family.libraryVersion`，需要复现某版时按该版 manifest 从 objects 拉。
