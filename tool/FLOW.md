# 流水线

TOS 唯一根 `library/`：`latest/`（对外）+ `private/`（母版）+ `keep/` + `release/`。

详细契约与发版门禁见 `.cursor/skills/otter-library/SKILL.md`。

```bash
# 契约（增删表情后必跑；数量跟 expr_keys.md）
./tool/otter check
cd ../otter-git && ./tool/otter check .

# 母版
cd ../otter-site
./tool/otter lib export          # source/still|video → expr
./tool/otter lib brand           # master → common + otter-*
./tool/otter lib publish --bump --notes "…"

# 片子
./tool/otter film pull otter-git
cd ../otter-films/otter-git/tutorial && npm run ship
cd ../../../otter-site && ./tool/otter film ingest otter-git
./tool/otter lib publish --bump --notes "otter-git tutorial"

# App 发版（内含 check；Win 由 GitHub Actions 上传后再 mirror）
cd ../otter-git && ./tool/otter assets && ./tool/otter ship --push
# 若 --no-wait：CI 传完后
# cd ../otter-site && ./tool/otter mirror otter-git 3.0.1
```

代理：`NO_PROXY` 含 `.volces.com,.volcengine.com`；其余可走本机代理。
