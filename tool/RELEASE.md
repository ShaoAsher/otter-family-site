# 发版入口（整合）

对象存储统一为**阿里云 OSS**（`otter` 桶）。旧火山 TOS 已废弃，不再读写。

契约与路径：`FLOW.md`、`.cursor/skills/otter-library/SKILL.md`。

## 日常同步

```bash
# 拉最新公开库到本地 otter-library
./tool/otter lib pull

# 三端各自拉品牌 / 表情进安装包资源
cd ../otter-git && ./tool/otter assets pull
cd ../otter-tools && ./tool/otter assets pull
cd ../otter-gametime && ./tool/otter assets pull
```

## 改素材后上云

```bash
./tool/otter lib brand          # 母版 → brand/platform
./tool/otter lib export         # 表情导出
./tool/otter lib publish --bump --notes "…"
# 或一键：./tool/otter launch sync
```

## 装包发版（Git / Tools）

```bash
./tool/otter check
cd ../otter-git && ./tool/otter ship --no-wait --push   # 跳过等 Win；Win 齐后再 mirror
# 或：./tool/otter launch otter-git --push
./tool/otter mirror otter-git <版本>   # Win 包齐后切 download.version
./tool/otter status otter-git
```

Gametime 走 App Store / Play，不经 `ship` 装包通道。

## CLI 对应脚本

| 命令 | 脚本 |
|------|------|
| `lib publish\|pull` | `tool/sync_oss.py` |
| `assets` | `tool/app/assets.py` |
| `ship` | `tool/release/ship.py` |
| `publish\|mirror\|status` | `tool/release/release.py` |
| `launch` | `tool/release/launch.py` |
| `check` | `tool/check.py` |

代理：`NO_PROXY` 含 `.aliyuncs.com`（及本机需要的 GitHub/Codeup）；不要为旧 TOS 域名留例外。
