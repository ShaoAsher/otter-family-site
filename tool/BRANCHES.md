# 水獭家族仓库分支约定（统一）

全家族**日常开发与桌面端发版**都在 **`main`**。`v<版本>` 标签打在 `main` 的 HEAD 上，再跑 `./tool/otter release` / `ship` / `launch … --push`。

| 仓库 | 远端默认分支（目标） | 发版 / CI | 说明 |
| --- | --- | --- | --- |
| **otter-family-site** | `main` | Pages、`family.json` | 官网与公共配置 |
| **otter-git** | `main` | push `main` → Windows CI → GitHub Release | 与家族仓 `tool/` 发版闸门一致 |
| **otter-tools** | `main` | 同上 | 旧 `release` / `develop` 已废弃，与 `main` 对齐后删远端 |
| **otter-gametime**（Gitee） | `main` | 应用商店发版（无桌面 ship） | 功能分支 `feat/*` 合入 `main`；`dev` 仅历史遗留，不再新开 |

## 推荐日常流程

1. `git checkout main && git pull`
2. `git checkout -b feat/<简述>` 开发
3. 合并进 `main`（PR 或本地 merge）
4. 发版：`pubspec` 版本 + `family.json` changelog → `git tag v<版本>` → `./tool/otter launch <app> --push`

自测可设 `OTTER_RELEASE_ANY_BRANCH=1` 跳过「必须在 main」检查，**正式发版不要设**。

## 废弃分支（清理中）

| 分支 | 原用途 | 处理 |
| --- | --- | --- |
| `develop` | git-flow 开发主线 | 快进合并到 `main` 后删远端（保留本地直到确认无引用） |
| `release` | git-flow 发布线 | 与 `main` 对齐后删远端 |
| `release-*` / git-flow | 临时发版 | 不再使用；改在 `main` 上 bump 版本 + 打标签 |

Windows 调试仍可 push `feature/windows**`（或 `feat/windows**`），只构建不传 Release。