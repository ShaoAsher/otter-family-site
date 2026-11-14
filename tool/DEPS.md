# 仓库依赖（水獭家族）

权威数据在 **TOS** 或 **家族仓**，App 仓库只保留代码与本产品运行时素材。

```text
otter-family-site/          family.json、tool/、packages/otter_kit、官网 HTML
         │
         ├── TOS config/      family.json（App 国内主读）
         ├── TOS expr/v3/     表情包（三端 ./tool/otter assets pull）
         ├── TOS brand/       公开 icon/mark/common（平台套件仅本机 otter_family/brand）
         ├── TOS site/        官网媒体
         └── TOS release/     安装包

../otter-git | otter-tools    otter.json → 家族 tool/otter（otter_proxy.sh）
         │
         ├── assets/brand/    本产品图标 + common 剪影（构建需要）
         ├── assets/otter/expr  不入 git，构建前 pull
         └── docs/mockup/     原型 → ../../assets/，不复制品牌 png

../otter-gametime/app        同上；expr 不入 git；无独立官网
```

克隆后：

```bash
source ~/.config/devkeys/env.sh
cd otter-family-site/otter_family && python3 source/sync_tos.py --pull brand
cd ../otter-git && ./tool/otter assets pull
```

发版见 [`RELEASE.md`](RELEASE.md)。