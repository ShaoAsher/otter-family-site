---
name: otter-library
description: >-
  水獭家族真相源与发版：library private/latest、表情 still/270·anim/270、otter_kit 门禁、
  otter check / ship / Windows CI。在改表情、改路径、发版、mirror、清理发版流程时使用。
---

# 水獭家族：真相源 + 发版

## 仓库

| 仓 | 职责 |
|----|------|
| `otter-library/` | 本地母版：`source/{still,video}` → `expr/{still,anim}/{1080,540,270}` |
| `otter-site/` | 枢纽：`family.json`、CLI、`otter_kit`、官网 Pages |
| `otter-git` / `otter-tools` / `otter-gametime` | 三端 App |
| `otter-films/` | 片子工程；`film ingest` 后再 `lib publish` |

TOS 根 `library/`：`private/`（母版）· `latest/`（对外）· `keep/` · `release/`。

## 表情契约（增删表情必跟）

钥匙清单真相源：`otter-site/tool/expr_keys.md`（表格里的 key）。

增删或改名表情时：

1. 改 `expr_keys.md`（+ 母版 `source/still|video`）
2. `./tool/otter lib export` → `lib publish`
3. 各 App：`./tool/otter assets pull`（瘦包 `pull bundle` 仅 still/270）
4. **跑** `./tool/otter check`（App 根再 `./tool/otter check .`）— 数量以清单为准，**不必改死数字**
5. 若改了路径布局（不是只加减 key）：升 `otter_kit` → 打 `kit-v*` → 三端 `pubspec` 升 `ref`

**现行路径（禁止旧式）：**

| 用途 | 路径 |
|------|------|
| 包内静帧 | `assets/otter/expr/still/270/<key>.webp` |
| TOS 动图 | `library/latest/expr/anim/270/<key>.webp` |
| kit 代码 | `OtterExprStore.stillAssetPath` / `anim/270/`；`FamilyConfig` → `library/family.json` |

禁止：`still_270` · `anim_270` · `expr/v3/` · `config/family.json`。

## CLI

在 `otter-site` 或经 App `./tool/otter`（`otter_proxy.sh`）：

```bash
./tool/otter check              # 清单 + library + kit
./tool/otter check .            # 再查当前 App 资源与遗留路径

./tool/otter lib export|brand|publish|pull
./tool/otter film pull|ingest <app>
./tool/otter assets             # App：默认 pull
./tool/otter ship --push        # 发版（内含 check + NO_PROXY）
./tool/otter mirror <app> <ver> # Win 包齐后切 download.version
./tool/otter status <app>
```

## 发版门禁

1. `otter_kit` ref ≥ 含 `still/270` 的 tag（当前 `kit-v1.0.3+`）
2. `./tool/otter check .` 通过
3. 代理：`NO_PROXY` 含 `.volces.com,.volcengine.com`；GitHub/sqlite3 可走本机代理
4. macOS：本机 `ship`（公证）
5. Windows：`main` 上 GitHub Actions → 上传 `otter-git-v<ver>` 的 `OtterGit-windows-x64.zip`（app id 必须是 `otter-git`）
6. 两处齐：`mirror` 才切 `download.version`；官网读的是这份

热修同版本：移 tag + 覆盖 Release；或升补丁号更干净。

## 官网

- Pages：`otter-family-site`；表情用 `family.expr` + `data-expr="anim/270/….webp"`
- 推含 `.github/workflows` 的改动需要 `workflow` scope，或 SSH push

## 不要做

- 用 Git/Codeup 管母版大文件
- 发版前关光代理又不预置 sqlite3
- 只改 App 资源路径不升 kit
- Windows CI 里 `ci_upload.py git`（错误；必须 `otter-git`）
