# 公司产品册导入与图片维护

本批资料来自 `D:\Bolg\pro` 的五份房屋产品册及电气设备照片。目录包含 **113 款产品：17 款模块化房屋、96 款电气设备**，每款均有英文与简体中文内容；太空舱只保留 D7。现有 30FT、20FT MINI 延续上一版公司产品册，其余新增参数保留资料出处。

展示图提取产品照片，去掉产品册标题、参数表、容量大字和周围品牌角标。设备本体的铭牌与安全标签保留。型号及参数显示在详情文字中，原始 PDF 作为产品附件，不修改原件。AC03 产品册的面积与尺寸存在冲突，详情注明需要确认，未自行编造参数、价格或认证。

## 前台与后台对应规则

- 正式页面只显示 Strapi 当前语言已发布的 Product；分类没有记录时显示空状态，不使用示例商品补齐。
- 每款产品的 `slug` 为型号标识，英文与中文使用同一个 `documentId`。
- `image` 是主图，`gallery` 是附图，`brochure` 是原始产品册 PDF。导入后均为媒体库文件，经 MinIO 保存；前台读取媒体字段。
- `categoryKey` 为固定分类，`category` 是当前语言的分类文案。新增苹果舱分类 `apple-cabins`。
- 后台编辑、换图并发布后，前台约 30 秒刷新。中英文的文字分别发布，图片共享。
- 已有 Operations 角色的权限不会被启动脚本覆盖。超级管理员可在角色设置中为 Product 的 `gallery`、`brochure`、`sourceReference` 授予所需读写权限；若未开放字段，在内容管理器布局中勾选显示。

## 准备导入包（Windows）

代码仓库已包含整理后的图片和双语目录，原始 PDF 不入 Git。保留 `D:\Bolg\pro` 和项目根目录的旧版 `Container House.pdf`，执行：

```powershell
node tools/package-company-products.mjs --source "D:/Bolg/pro"
```

此命令核验文件 SHA-256，将展示图片及六份 PDF 打包目录准备到 `.cache/product-import`，合计约 110 MB。不会连接后台或改写源文档。转成传输文件：

```powershell
tar -czf .cache/product-import.tar.gz -C .cache/product-import .
```

使用现有 SSH 密钥将压缩包传到 ECS 的 `/opt/www/migration/`。如需从源资料重新制作展示图片，Python 需要 PyMuPDF、Pillow、NumPy、OpenCV：

```powershell
python tools/prepare-company-products.py --source "D:/Bolg/pro"
```

生成器中的页码、照片对象及裁切范围对应本批原始 PDF；原文件更换后须先核对这些位置，不能直接套用旧页码。

## 导入 ECS

先完成当前分支合并与既有 ECS 部署流程，**同时构建和更新 CMS、Web**。CMS 镜像须包含新增模型字段和 `scripts/import-company-products.cjs`。继续使用服务器现有 `zd-compose`，无需更改 Nginx。

以下命令在 ECS 项目目录 `/opt/www/web` 逐条执行。导入使用当前 CMS 的数据库和 MinIO 配置，不需要额外 API 密钥。

```bash
mkdir -p /opt/www/migration/company-products
```

```bash
tar -xzf /opt/www/migration/product-import.tar.gz -C /opt/www/migration/company-products
```

```bash
docker cp /opt/www/migration/company-products/. "$(zd-compose ps -q cms)":/tmp/company-products
```

先预览计划；默认不上传文件、不创建或发布产品：

```bash
zd-compose exec -T cms npm run import:products -- --bundle /tmp/company-products
```

确认报告中的产品后，执行实际导入：

```bash
zd-compose exec -T cms npm run import:products -- --bundle /tmp/company-products --apply
```

`create` 创建产品，`update` 更新仍未人工修改的已导入产品或原始初始化产品，`unchanged` 表示已一致，`preserved` 表示保留人工编辑、未发布译文或冲突记录。脚本只操作 Product 和媒体文件，不更改 FAQ、询盘、管理员和网站设置。

文件按内容校验和复用；两个语言的同一款产品在同一事务内更新和发布。失败后可以重复运行，已完成的产品不会重复创建；人工编辑的产品不会被强制覆盖。报告为 `preserved` 的条目应由管理员逐条核对，脚本不擅自发布已有草稿。

如果安装时尚未配置简体中文，实际导入会添加 `zh-Hans`；预览模式会提示先添加语言。

## 验收与日常维护

在后台 Content Manager → Product 按型号搜索，例如 `AC01`、`D7`、`31500`，检查语言、分类、主图、图库及产品册；再到对应前台分类页核对同一款产品。列表支持搜索和每页 24 款的分页，CMS API 每页读取 100 条，避免产品数量超过首页上限而漏显示。

换图时直接编辑 Product 的 `image` 或 `gallery`，保存并发布；不需要改代码中的图片路径。产品册 PDF 可通过 `brochure` 单独替换。新图片须自行提供无排版文字的版本，导入工具的图像清理仅针对本批公司源文件。

验证命令：`npm test`、`npm run build:web`、`npm run build:cms`；浏览器检查见 `tests/smoke/company-products-browser.mjs`。`tests/integration/company-catalogue.cjs` 必须在独立测试数据库和存储桶中运行，明确要求 `CATALOGUE_INTEGRATION_TEST=true` 且数据库名称以 `test_` 开头。
