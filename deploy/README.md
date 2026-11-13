# 生产部署与隔离恢复

本目录用于单台 Linux 云服务器：PostgreSQL 16、Strapi、Next.js standalone、Nginx HTTPS。数据库没有宿主端口并使用生产专属命名卷。CMS 使用 S3 兼容上传接口；基础 Compose 可连接外部存储，自建 MinIO 时额外加载 `docker-compose.minio.yml`。单服务器不是高可用方案；主机故障会中断服务，异地备份与恢复演练仍必需。

## bjzdbuilding.com：现有 GitLab 与 MinIO 共用 ECS

当前正式方案采用自建 MinIO。完整逐条部署命令见 [阿里云 ECS 与域名配置教程](../docs/operations/aliyun-ecs-bjzdbuilding.md)。这台机器已有 GitLab Nginx 占用 80，因此用教程的 `zd-compose` 加载基础配置、MinIO 配置和宿主入口覆盖文件；不直接启动下方通用示例中的容器 `nginx`。

- MinIO 从固定上游源码版本构建，持久化目录为 `/srv/zhuduo/minio-data`，需预先设置 UID/GID `10001:10001` 写入权限。社区上游已归档，具体版本与维护情况见教程第 5 节。
- 仅 `127.0.0.1:19000` 发布 S3 API；Web 控制台关闭。CMS 用独立桶权限账号，根账号只用于 MinIO 服务本身及存储初始化，不注入 CMS / Web。
- CMS 与初始化任务经内部 `storage` 网络访问 MinIO。MinIO 另连只有自身加入的普通桥接网络 `storage_host`，使 Docker 实际发布宿主机端口；只连接 `internal: true` 网络会导致声明了端口但宿主机连接被拒绝。
- 公共图片地址为 `https://media.bjzdbuilding.com/zhuduo-media/…`，`media` A 记录指向 ECS；宿主 Nginx 只代理该桶的 GET / HEAD，请勿将整个 S3 根路径或管理接口公开。
- 基础 `docker-compose.yml` 的 Nginx 模板没有 MinIO 媒体入口；自建存储需要按专用教程配置宿主 Nginx 和四个域名的证书。

下面的通用部署流程仍适用于外部 S3 与独立 Nginx 容器环境。

## 准备生产配置

1. 安装 Docker Engine、Compose v2 或兼容的 standalone Compose，以及备份用 Bash、rclone、sha256sum。服务器需要访问镜像源、S3 和可选的 Turnstile 验证服务。
2. 将 `.env.example` 复制到仓库根 `.env`，`chmod 600 .env`，填入两个不同的真实域名（仅 DNS 名称，无协议/端口）和全部空白必填项。为站点/CMS配置 DNS；直接端口开发配置不要用于生产。Compose 会拒绝缺失的凭据，但不会替你判断凭据强度。密钥可用 `openssl rand -hex 32` 分别生成；`APP_KEYS` 为至少两个独立值的逗号列表。应用密钥、加密密钥、S3 凭据与生产数据库密码不要复用开发值。
3. `TLS_CERTS_DIR` 指向宿主绝对目录，里面有 `site/fullchain.pem`、`site/privkey.pem`、`cms/fullchain.pem`、`cms/privkey.pem`。证书/私钥只读挂载，仓库与 Docker 构建上下文排除密钥。使用 DNS 验证申请证书，或单独配置 HTTP ACME 路径；现有模板将 HTTP 全部跳转 HTTPS，不自动申请/续期证书。续期后执行 `docker compose exec nginx nginx -t` 和 `docker compose exec nginx nginx -s reload`。

Nginx 的规范配置源文件是 `deploy/nginx/conf.d/site.conf`；Compose 将它只读挂载到官方 entrypoint 处理的 `/etc/nginx/templates/site.conf.template`，由 entrypoint 根据 `SITE_DOMAIN` 和 `CMS_DOMAIN` 渲染后加载。
4. `S3_ENDPOINT` 是 CMS 访问的服务端地址。`MEDIA_PUBLIC_URL` 是浏览器可访问的 HTTPS 媒体前缀；保证 bucket、`S3_ROOT_PATH` 和公开地址映射一致。仅媒体范围允许匿名读取，管理接口与备份桶保持私有。不要把客户附件放入公开媒体桶。Nginx 默认不代理媒体/管理控制台；要增加媒体域名，先确认对应的公开前缀权限。
5. `RELEASE_TAG` 使用部署的 git SHA 或发布编号。CMS 构建只接收公开的 CMS 域名，后台 bundle 固化这个地址；改域名需要重建 CMS。所有应用/数据库/S3 密钥仅运行时注入，无凭据 build ARG。不要将真实 `.env`、宿主 node_modules 或 Windows 构建输出打入镜像。

Turnstile 默认关闭：两个 key 留空。启用时同时设置 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY`，并将 `TURNSTILE_EXPECTED_HOSTNAME` 设为真实站点域名（无协议/端口）。site key 在 CMS/web 运行时注入；secret 和验证 hostname 仅 CMS 可见。半配置会拒绝保存询盘，不能视为成功。VM 开发示例也支持这组可选值；直接端口开发的 Web 固定 `TRUST_PROXY=false`，宿主运行应用时同样保持 false。

## 构建、启动与上线验收

从仓库根执行（真实 `.env` 不应提交）：

```sh
docker compose config --quiet
docker compose build cms web
docker compose up -d postgres cms web nginx
docker compose ps
docker compose exec nginx nginx -t
curl --fail https://www.your-domain.example/api/health
curl --fail https://cms.your-domain.example/api/health
```

两个 Dockerfile 均以仓库根为 context，用 Linux Node 24 明确 patch 标签构建。Web 入口是 `/app/apps/web/server.js`，复制整个 standalone 与嵌套 static/public。CMS 保存完整 `dist`（含 `dist/build` admin）、tsconfig、contracts workspace、生产依赖及应用根 `database/migrations`，用非 root 用户启动。CMS `/api/health` 包含数据库检查；不存在虚构的 `/_health`。生产默认 `SEED_DEMO_CONTENT=false`，通过 `/admin` 创建管理账号并录入真实内容。

上线前在有 Docker 的环境完成以下验收：镜像实际构建/启动，两个健康检查，正式域名 HTTPS/证书，admin 登录及静态资源，S3 上传/读取/删除，发布内容网站可见，询盘真实入库与后台权限，重启后内容/图片保留，伪造 XFF 不绕过限流，以及隔离目标真实恢复演练。这里的配置测试、应用 build 或旧 VM 的 UI 验收均不能替代这些生产容器检查。

本地结构/编排验证：`node --test tests/deployment/*.test.mjs`。Compose 测试使用临时、非机密 fixture env，Linux 默认调用 `docker compose`，Windows 默认调用 `.cache/tools/docker-compose-v5.6.0.exe`；可用 `COMPOSE_BIN` 指定 standalone CLI。备份测试只执行真实脚本与受控 CLI 替身，不访问真实 DB/S3；Linux 使用 Bash，Windows 自动查找 Git Bash，可用 `BASH_BIN` 指定 shell。测试命令不是备份/恢复演练。

Nginx 是唯一公网应用入口，覆盖 XFF 为 `$remote_addr`，CMS 清空外部 `X-Inquiry-Client` 并拒绝 `/api/inquiries/submit`；内部 Web 使用服务密钥调用 CMS。后台 Authorization 保留。站点 body 上限 64 KiB，CMS 上传请求上限 25 MiB，连接超时 10 秒、上传/响应代理超时 120 秒；上传实际可用大小还受 Strapi/provider 限制。TLS 仅 1.2/1.3。模板仅替换 SITE_DOMAIN/CMS_DOMAIN，避免清空 Nginx 原生变量。更改 Compose 创建/重建应用容器后重启 Nginx，以刷新上游 DNS。将来增加 CDN/LB 时必须重新设计可信代理与客户端来源校验，不能直接追加/信任用户 XFF。

不要执行生产 `docker compose down -v`。不要把开发卷挂给生产。PostgreSQL 已初始化后，仅更改 `.env` 不会自动修改已有数据库角色密码；按数据库流程完成轮换并同步应用配置。

## 私有异地快照备份

备份会停止原来处于 running 状态的 CMS/web，因此网站与询盘有维护停机窗口。数据库与 S3 没有共同事务；先停用外部上传、删除、导入任务等所有其他写入者，并与运维协调。脚本停止 CMS/web 写入后执行 `pg_dump -Fc`、S3 对象复制与逐对象下载验证，再恢复原来 running 的服务。若中途失败或收到 TERM/INT，trap 会尝试恢复服务；恢复失败返回错误并要求人工处理。`docker compose start` 恢复运行状态，不证明业务已健康，备份后仍检查健康。

在宿主以独立运维账号配置两个不同名字、不同凭据的 rclone remote：源 remote 对实际媒体 bucket/prefix 只读；异地 remote 指向**另一个故障域/独立账号的私有 S3 备份桶**，具备写入/列举/读取权限。不同 remote 名称不是物理异地的证明，必须由运维核实。保护 `rclone.conf`，不要在终端打印凭据。脚本不读取 `.env` 为 shell 代码；Compose 自行读取 `.env`，备份变量单独 export 或由受保护的运维环境注入：

```sh
export BACKUP_LOCAL_DIR=/var/backups/modular-housing
export BACKUP_SOURCE='source:production-media/root-prefix'
export BACKUP_TARGET='offsite:private-backups/modular-housing'
export BACKUP_RELEASE='deployed-git-sha-or-image-release'
export MEDIA_PUBLIC_URL='https://media.your-domain.example/root-prefix'
# 表示已接受维护停机，并已暂停所有额外源写入者。
export BACKUP_CONFIRM_WRITES_PAUSED=yes
bash deploy/backup/backup.sh
```

本地 umask 077；每次使用 UTC 时间戳与随机后缀，`rclone copy` 创建历史快照，不执行 mirror/sync 删除。异地布局为 `<timestamp>/media/`、`<timestamp>/database/{database.dump,manifest.txt,images.json,SHA256SUMS}` 和最后写入的 `<timestamp>/COMPLETE`。`images.json` 记录已创建容器实际使用的镜像标识。只有**异地 COMPLETE 存在且验证通过**的快照可用于恢复。dump/copy/check/服务恢复/完成标记上传任一步失败都会非零退出，不输出 SUCCESS；保留失败的部分目录供排错，不能当作完整快照。目录锁避免并发窗口；进程异常终止（如 SIGKILL/主机掉电）后的 `.backup-lock` 需运维核查服务状态后手动解除。脚本不清理历史快照，存储生命周期/保留策略另行审核。

数据库包含客户询盘，所有快照、本地目录及目标桶必须私有，启用存储加密与最小访问权限。manifest 记录版本、PG主版本、媒体源/地址与验证结果；SHA256SUMS 校验 dump 与 manifest。保护 rclone 凭据与 **Strapi APP_KEYS、ENCRYPTION_KEY、token salts、JWT 等密钥的独立加密备份**；不把明文密钥写入 manifest 或公开媒体。保存同版本代码/镜像（最好记录实际 digest），恢复需要相同加密密钥。

## 恢复到全新隔离目标

先在隔离服务器/网络创建全新的 PostgreSQL 16 数据库/卷与空的私有恢复媒体桶/prefix；关闭恢复 CMS/web，不触碰现有生产数据。不提供带 `--clean` 或覆盖当前生产库的默认命令。

1. 选择同一个存在异地 COMPLETE 的 snapshot，下载 database 文件和媒体到受保护的工作目录。先检查标记，再在 database 目录运行 `sha256sum -c SHA256SUMS`；错误立即停止。
2. 将 snapshot/media 复制到空的恢复桶/prefix；对源快照与恢复目标运行 `rclone check ... --download`。恢复路径必须与 CMS `S3_ROOT_PATH` 相同，并保留公开地址中的桶路径。不要修改/删除原媒体目标。
3. 对新建、空数据库恢复（凭据通过受保护的环境或 pgpass 传递）：

   ```sh
   pg_restore --no-owner --no-acl --exit-on-error \
     --host=ISOLATED_DB_HOST --username=RESTORE_USER \
     --dbname=FRESH_EMPTY_DB ./database.dump
   ```

4. 配置同版本代码/镜像、原 Strapi 加密/应用密钥、隔离 DB/S3/域名，重新构建绑定新域名的 admin 并启动服务。注意：Strapi 在上传时已将绝对地址存入 `file.url` 与 `formats.*.url`；仅修改 `MEDIA_PUBLIC_URL` 不会重写恢复库中的旧记录。测试客户端及需要读取图片的隔离服务应将原媒体域名通过隔离 DNS / hosts 映射到恢复入口，并使用匹配域名的有效 TLS；也可以只在恢复数据库中审核、替换文件和各格式的完整媒体 URL 前缀。不要修改生产 DNS 或生产数据库来做恢复演练。
5. 阻断演练环境对生产媒体源的访问后，验证 admin 登录、真实图片读取、询盘数据、权限与重启持久化，避免误把生产图片当成已恢复图片；审核文件条数与业务数据。定期记录恢复耗时、停机时间与实际能恢复的数据范围；验证后才安排生产切换。

参考：[Next standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)、[Strapi 部署](https://docs.strapi.io/cms/deployment)、[Nginx HTTPS](https://nginx.org/en/docs/http/configuring_https_servers.html)、[pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html)、[pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html)、[rclone copy](https://rclone.org/commands/rclone_copy/)、[rclone check](https://rclone.org/commands/rclone_check/)。镜像 patch 标签依据 [official-images Node](https://github.com/docker-library/official-images/blob/master/library/node)、[Postgres](https://github.com/docker-library/official-images/blob/master/library/postgres)、[Nginx](https://github.com/docker-library/official-images/blob/master/library/nginx) 发布清单；仍需在 Docker 主机实际拉取并构建验收。
