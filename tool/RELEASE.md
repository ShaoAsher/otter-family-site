# 发版

## 素材（增量，不全量备份）

```bash
cd otter-family-site/otter_family
python3 source/sync_tos.py library publish --bump --notes "改了什么"
# 新对象 → objects/；manifest → versions/vX/；公开树 → current/ 仅覆盖变更
git add ../family.json && git commit && git push
```

`family.libraryVersion` 钉 App 溯源；官网 URL 走 `library/current/`。

## App

```bash
./tool/otter assets pull
./tool/otter package --notarize
./tool/otter release --use-dist
```

`./tool/otter launch sync` = `library publish`（不 bump）。
