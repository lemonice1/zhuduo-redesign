# 集装箱房 / 模块化建筑独立站

当前交付是一套中英文首页与内容、询盘后台的开发版本：Next.js 前台、Strapi 5 后台、PostgreSQL 数据库、MinIO 图片存储。Ubuntu 22.04 本地 VM 用 Docker Compose 启动。

正式上线到 `43.110.24.91`、配置 `bjzdbuilding.com` 与自建 MinIO，请使用 [阿里云 ECS 部署教程](docs/operations/aliyun-ecs-bjzdbuilding.md)；该方案保留现有 GitLab Nginx 入口。

## 在 VM 启动

将整个项目复制到 VM，例如 `~/projects/modular-housing`，保留 `package-lock.json`，无需复制 Windows 的 `node_modules`、`.next` 和 `dist`。

```bash
cd ~/projects/modular-housing
cp .env.vm-dev.example .env
nano .env
```

将 `VM_HOST` 改成 Windows 浏览器可访问的 VM IP，并修改开发密码与密钥。随后执行：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env config --quiet
docker compose -f docker-compose.vm-dev.yml --env-file .env pull
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d
docker compose -f docker-compose.vm-dev.yml --env-file .env ps -a
```

首次启动会安装依赖、创建图片桶并初始化示例内容，速度取决于 VM 资源和下载速度。`deps`、`minio-init` 显示 `Exited (0)` 属于正常完成。

开发图片存储使用 Net Insight 保留的上游 MinIO 服务端和客户端固定版本镜像，通过 [1Panel 镜像缓存](https://1panel.pro/docs/v2/user_manual/containers/setting/) 拉取，避免 VM 直连 Docker Hub。已有 `.env` 中的 `MINIO_IMAGE` / `MC_IMAGE` 会覆盖 Compose 默认值，拉取新代码后按 [VM 开发指南](docs/operations/vm-development.md#更新旧版本的镜像配置) 更新这两项。

| 功能 | 地址 |
| --- | --- |
| 首页（支持中英文切换） | `http://VM_IP:3000` |
| Strapi 后台 | `http://VM_IP:1337/admin` |
| MinIO 控制台 | `http://VM_IP:9001` |

完整步骤、排错和日常命令见 [VM 开发指南](docs/operations/vm-development.md)。

## 已实现的功能

- 首页：绿色 / 米白的摄影式布局、轮播图、CMS 分类筛选与产品详情弹窗、应用场景、FAQ、手机菜单、中英文切换、产品文字目录下载和真实询盘表单。
- 产品中心：电气设备、模块化房屋两大类菜单，独立分类页与产品详情页；后台 Collection Types → 产品分类可增删分类、编辑多语言名称、排序和菜单显示，产品选择已发布分类。见[产品分类操作说明](docs/operations/product-categories.md)和[产品编辑说明](docs/operations/product-editing.md)。
- 内容：Strapi 管理产品、FAQ、网站名称与联系邮箱；已发布内容通过只读 `/api/homepage` 提供给前台。
- 媒体：Strapi 上传图片至 MinIO，产品的 `image` 字段用于首页图片。
- 询盘：浏览器 → Next.js 服务端 → Strapi → PostgreSQL；必填校验、长度限制、蜜罐与每分钟提交限制；保存回执成功后才提示已收到。
- 隐私：浏览器不接触服务间密钥；询盘不开放匿名列表、详情、更新与删除 API；销售在 Strapi 后台查看和跟进。

`STRAPI_SERVER_TOKEN` 是前台服务与后台服务共用的自定义密钥，直接在 `.env` 设置即可，无需在 Strapi 后台创建 API Token。MinIO 图片桶由初始化容器自动创建。

示例品牌 `ZhuDuo`、邮箱和产品文案需要替换。未提供产品图片时使用带“参考摄影”标签的建筑照片，场景图片不代表已完成客户项目。当前未提供独立产品详情页、案例页面或邮件通知。后台已有案例内容模型，生产部署配置见部署文档。新版交互与更新方法见 [首页改版说明](docs/operations/homepage-design.md)。

## 开发与验证

使用 Node.js 24。整套 VM 服务不要求在 VM 宿主机安装 Node.js；Docker 中会安装依赖。直接在宿主机开发时先执行 `npm ci`：

```bash
npm run dev:web
npm run dev:cms
npm test
npm run build:web
npm run build:cms
npm run test:smoke
```

直接启动 CMS 需要 PostgreSQL、S3 与 Strapi 环境变量，推荐使用上述 VM Compose。仅直接预览前台且不设置 CMS 地址时，会使用开发示例内容；询盘接口未配置时返回错误，不会假报保存成功。

`test:smoke` 启动已构建的 Next.js，通过 HTTP CMS 测试替身验证内容加载、询盘代理、异常和限流；它不证明真实数据库或 MinIO 已连通。实测范围见 [验证记录](design-qa.md)。

旧 `docker-compose.dev.yml` / `.env.dev.example` 保留为仅启动基础设施的选项；完整 VM 开发使用 `docker-compose.vm-dev.yml` / `.env.vm-dev.example`。
