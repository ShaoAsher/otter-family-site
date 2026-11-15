# 流水线

TOS 唯一根 `library/`：`latest/`（对外）+ `private/`（母版）+ `keep/` + `release/`。

```bash
# 母版
./tool/otter lib export          # source/still|video → expr
./tool/otter lib brand           # master → common + otter-*
./tool/otter lib publish --bump --notes "…"

# 片子
./tool/otter film pull otter-git
cd ../otter-films/otter-git/tutorial && npm run ship
cd ../../../otter-site && ./tool/otter film ingest otter-git
./tool/otter lib publish --bump --notes "otter-git tutorial"

# App
cd ../otter-git && ./tool/otter assets && ./tool/otter ship
```
