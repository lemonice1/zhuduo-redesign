# Ubuntu 22.04 本地 VM 开发指南

## 1. 准备 VM

建议为完整开发栈分配至少 4 核、8 GB 内存和 30 GB 可用磁盘空间。确认 Docker Engine 与 Compose v2 已安装：

```bash
docker version
docker compose version
ip -4 addr
```

安装方式以 [Docker 官方 Ubuntu 文档](https://docs.docker.com/engine/install/ubuntu/) 为准。命令提示 Docker socket 权限不足时，可在每条 `docker` 命令前加 `sudo`。

VM 网络需让 Windows 能访问其 IP。桥接网卡或宿主机专用网络都可以；使用只有 NAT 的网络时，应配置端口转发。开发服务只供本机或可信局域网使用。

将项目完整复制到 VM 的同一目录，至少包括 `apps/`、`packages/`、`deploy/`、根目录 `package.json`、`package-lock.json`、Compose 和环境变量示例。不要从 Windows 复制依赖目录与构建产物；Linux 容器使用自己的依赖卷。

## 2. 配置环境变量

```bash
cd ~/projects/modular-housing
cp .env.vm-dev.example .env
nano .env
```

必须根据实际环境修改：

| 变量 | 用途 |
| --- | --- |
| `VM_HOST` | Windows 浏览器能访问的 VM IP，例如 `192.168.1.100`；只填主机名/IP，不加协议、端口或斜杠 |
| `POSTGRES_PASSWORD` | 开发数据库密码 |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO 控制台登录与开发上传凭据 |
| `MINIO_IMAGE` / `MC_IMAGE` | 开发图片存储的服务端和客户端镜像，默认使用 Net Insight 保留的固定版本副本 |
| `STRAPI_SERVER_TOKEN` | Next.js 与 Strapi 之间共用的询盘提交密钥 |
| `APP_KEYS` | 两个随机密钥，用逗号分隔 |
| `ADMIN_JWT_SECRET` / `API_TOKEN_SALT` / `TRANSFER_TOKEN_SALT` / `ENCRYPTION_KEY` | Strapi 后台所需密钥 |

可用 `openssl rand -hex 32` 为每个密钥分别生成随机值。密钥保存在 `.env`；不要放入 `NEXT_PUBLIC_*` 变量或前台代码。`SEED_DEMO_CONTENT=true` 只在开发模式初始化示例产品、FAQ 与设置，不会覆盖已有同名记录。

`STRAPI_SERVER_TOKEN` 由自定义接口直接校验，与 Strapi 后台的 API Token 管理功能没有关系。Compose 为两个服务传入同一个值，不需要手动开启 Public 角色的询盘权限。

图片存储默认使用下列开发镜像：

```dotenv
MINIO_IMAGE=docker.1panel.live/netiedge/minio:RELEASE.2025-01-20T14-49-07Z
MC_IMAGE=docker.1panel.live/netiedge/minio-mc:RELEASE.2025-01-17T23-25-50Z
```

发布者 Net Insight 说明这两个仓库保留了上游的原始镜像层，支持 Linux amd64 / arm64，来源见 [MinIO 服务端](https://hub.docker.com/r/netiedge/minio) 和 [MinIO 客户端](https://hub.docker.com/r/netiedge/minio-mc)。默认显式通过 [1Panel 镜像缓存](https://1panel.pro/docs/v2/user_manual/containers/setting/) 拉取，VM 需能访问 `docker.1panel.live`，无需直连 Docker Hub，也不用改 Docker daemon 的全局镜像加速设置。当前版本用于开发流程验证，生产环境需另行确认有维护来源的 S3 兼容服务。

## 3. 启动

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env config --quiet
docker compose -f docker-compose.vm-dev.yml --env-file .env pull
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d
docker compose -f docker-compose.vm-dev.yml --env-file .env ps -a
```

启动顺序为：`deps` 安装工作区依赖，PostgreSQL 就绪，`minio-init` 创建图片桶并设置公开下载权限，CMS 初始化模型与示例内容，最后启动前台。第一次需下载镜像、npm 包和构建后台界面，可能需要数分钟。

`deps`、`minio-init` 是一次性初始化服务，`Exited (0)` 正常。`postgres`、`cms`、`web` 应运行且健康；`minio` 保持运行。Mailpit 和 Adminer 默认不启动。

### 更新旧版本的镜像配置

已有 VM 从旧示例创建了 `.env` 时，`git pull` 不会更新该文件；旧的 `MINIO_IMAGE` / `MC_IMAGE` 仍会覆盖新的 Compose 默认值。在项目根目录执行下面命令，更新这两项并将原文件备份为 `.env.bak`，其余密码、密钥、IP 和端口保留：

```bash
git pull --ff-only
sed -i.bak \
  -e 's|^MINIO_IMAGE=.*|MINIO_IMAGE=docker.1panel.live/netiedge/minio:RELEASE.2025-01-20T14-49-07Z|' \
  -e 's|^MC_IMAGE=.*|MC_IMAGE=docker.1panel.live/netiedge/minio-mc:RELEASE.2025-01-17T23-25-50Z|' .env
docker compose -f docker-compose.vm-dev.yml --env-file .env config --images
docker compose -f docker-compose.vm-dev.yml --env-file .env pull
```

确认图片存储的两个镜像地址正确且拉取成功后，再执行 `docker compose -f docker-compose.vm-dev.yml --env-file .env up -d`。若自行配置了其他可用镜像仓库，保留自己的 `MINIO_IMAGE` / `MC_IMAGE`。

### 镜像缓存不可用时

镜像缓存是第三方网络服务，其可用性可能变化。若 1Panel 地址无法连接，可先单独验证 [毫秒镜像](https://1ms.run/guide) 中的同版本镜像：

```bash
docker pull docker.1ms.run/netiedge/minio:RELEASE.2025-01-20T14-49-07Z
docker pull docker.1ms.run/netiedge/minio-mc:RELEASE.2025-01-17T23-25-50Z
```

两条都成功后，把 `.env` 中这两项的 `docker.1panel.live/` 改为 `docker.1ms.run/`，再执行 Compose 启动命令。若 VM 可以通过网络代理访问 Docker Hub，也可改回 `registry-1.docker.io/netiedge/…`；代理需配置到 Docker daemon，仅设置终端的代理环境变量不会让 daemon 使用代理。

## 4. 打开网站与后台

以下端口可在 `.env` 修改；修改后应重新运行 `up -d`。

| 功能 | 默认地址 | 首次操作 |
| --- | --- | --- |
| 前台 | `http://VM_IP:3000` | 检查三类示例产品、FAQ 与表单 |
| Strapi | `http://VM_IP:1337/admin` | 创建第一个管理员账户 |
| MinIO API | `http://VM_IP:9000` | 公开图片 URL 的基础地址 |
| MinIO Console | `http://VM_IP:9001` | 使用 `.env` 的 MinIO 账户登录 |

图片上传使用容器内地址 `http://minio:9000`；生成给浏览器的图片地址使用 `VM_HOST`。不能把 `minio` 这个容器主机名填给浏览器。默认桶 `modular-housing-dev` 自动建立，只用于公开产品图片；客户资料不要上传到该桶。

若 VM IP 改变，更新 `.env` 的 `VM_HOST` 并重建服务配置：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d
```

Strapi 可能已保存旧 IP 的媒体 URL，已有图片需重新上传或迁移 URL；为减少此问题，建议固定 VM IP。

## 5. 验证真实业务流程

1. 在 Strapi 的 Content Manager 打开一个 Product，修改标题、摘要或可定制选项，保存并发布；前台约 30 秒后刷新内容。
2. 从 Media Library 上传图片，绑定到产品的 `image` 字段，保存并发布。检查前台图片显示以及 MinIO 桶内文件。
3. 在首页填写有效询盘，收到真实引用编号后，在 Strapi 的 Inquiry 集合中核对姓名、邮箱、产品方向、数量与需求。
4. 在后台修改询盘跟进状态与内部备注。未登录请求 `GET /api/inquiries` 应无法获取询盘列表。
5. 重启 CMS 后再次查看上述内容与询盘，确认持久化。

直接向 CMS 提交且未带服务间密钥时应返回 401：

```bash
curl -i -X POST "http://VM_IP:1337/api/inquiries/submit" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","country":"UK","message":"VM check"}'
```

这套流程尚需在实际 VM 执行；本地 Windows 的 HTTP 冒烟测试使用 CMS 测试替身，没有真实 PostgreSQL/MinIO。

## 6. 日常命令

查看最近日志：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env logs --tail=100 deps minio-init cms web
```

停止或重新启动应用：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env stop
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d
```

代码通过项目目录挂载，前台与 CMS 支持开发热更新。修改 `package.json` 或锁文件后，先停应用，再单独更新依赖，避免多个应用同时安装：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env stop web cms
docker compose -f docker-compose.vm-dev.yml --env-file .env run --rm --no-deps deps
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d
```

数据库与图片保存在命名卷。普通 `down` 保留卷；`down -v` 会删除开发数据库、媒体和依赖卷，日常停止不要加 `-v`。修改 PostgreSQL 初始化密码不会自动修改已有卷中的数据库账户，应同步更新该账户密码或恢复原配置。

可选管理工具：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env --profile tools up -d
```

Adminer 在 `http://VM_IP:8080`，系统选 PostgreSQL，服务器填 `postgres`，账户和数据库按 `.env`。Mailpit UI 在 `http://VM_IP:8025`；当前应用未接入邮件通知，仅启动 Mailpit 不会收到询盘邮件。

## 7. 常见问题

- **页面无法访问：** 核对 VM IP、网卡与端口转发，检查 `ps -a` 和应用日志。Docker 发布的端口以 Docker 的网络规则为准，不能只依赖 UFW 控制访问。
- **拉取图片存储镜像返回 `denied`：** 用 `config --images` 检查实际镜像地址，按上述步骤更新已有 `.env` 中的旧 MinIO 地址；DaoCloud 当前也未将 Net Insight 的这两个副本列入白名单，默认配置使用 1Panel 镜像缓存。
- **拉取报 `registry-1.docker.io` 连接被拒绝或超时：** 这是 VM 到 Docker Hub 的网络连接失败，尚未查询镜像标签。已有 `.env` 若仍使用源地址，按上述步骤切换到镜像缓存。
- **镜像拉取出现 DNS 错误或缓存地址连接超时：** 检查 VM 域名解析、默认路由和网络，尝试上述备用缓存。均不可用时，为 Docker daemon 配置网络代理，或从可访问的机器导入对应镜像。
- **`deps` 失败：** 检查镜像/npm 下载网络以及锁文件是否完整。修复后执行一次 `run --rm --no-deps deps`，再 `up -d`。
- **`minio-init` 失败：** 检查 MinIO 日志、镜像拉取与密码；应用会等待图片桶初始化成功。当前固定镜像属于本地开发配置，可通过 `MINIO_IMAGE` / `MC_IMAGE` 改为你们已验证的镜像。
- **CMS 不健康：** 检查 PostgreSQL 凭据、Strapi 密钥、依赖安装日志和内存是否足够。不要在尚未就绪时同时反复运行多个初始化命令。
- **图片存在但不显示：** 核对 `VM_HOST`、媒体 URL 与桶的公开下载策略。
- **询盘 503：** 直接启动前台时未配置 CMS 地址或服务间密钥。
- **询盘 502：** 后台不可用、密钥不一致、数据库写入失败或缺少保存回执；查看两个应用日志。
- **询盘 429：** 单个来源一分钟内超过 5 次请求，等待窗口恢复。

本文件运行的是热更新开发环境。云服务器上线时另行配置生产构建、HTTPS、反向代理、备份和正式域名。
