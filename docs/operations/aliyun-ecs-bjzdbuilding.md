# ZhuDuo：阿里云 ECS 部署与 bjzdbuilding.com 域名配置

编写日期：2026-10-15。适用系统：Ubuntu 22.04 / 24.04，单台 ECS，Docker Compose，已有 GitLab 与网站共用服务器。

本教程按目前提供的信息编写：公网 IP 为 `43.110.24.91`、内存 128 GB、代码仓库为 `http://43.110.24.91/zd/web.git`，发布分支为 `main`。正式图片存储采用自建 MinIO；CPU、磁盘容量及实际地域需要在 ECS 控制台核对。本次部署文件须先更新到远端 `main`，再在 ECS 拉取。

**执行位置：除明确标注“Windows”或“阿里云控制台”的步骤外，命令均在 ECS 的 root 终端逐条执行。** 多行的 `cat` / Python 命令需要整块粘贴；其余命令可以逐条执行。每一步成功后再继续下一步。

## 1. 先理解这台服务器的部署方式

当前服务器的 80 端口已经提供 GitLab，8080 端口有 Ruby 服务；Docker 没有运行容器。因此，本教程保留现有入口，部署 PostgreSQL、Strapi、Next.js、MinIO 四个常驻容器及一次性的存储初始化任务，**不启动项目自带的 Nginx 容器**。

```text
访客 ── HTTPS ── 现有 Nginx
                  ├─ bjzdbuilding.com       → 127.0.0.1:13000 → Next.js 容器
                  ├─ www.bjzdbuilding.com   → 跳转到主域名
                  ├─ cms.bjzdbuilding.com   → 127.0.0.1:11337 → Strapi 容器
                  ├─ media.bjzdbuilding.com → 127.0.0.1:19000 → MinIO 公开图片
                  └─ 43.110.24.91          → 保留原 GitLab 服务

Strapi ── 容器内网 ── PostgreSQL 16
Strapi ── 存储容器内网 ── MinIO → /srv/zhuduo/minio-data（宿主机持久化）
```

本教程的默认入口是 **GitLab Linux 安装包附带的 Nginx**。第 2 步会确认这一点。如果实际是独立系统 Nginx，按第 15 节替换入口操作，应用部署步骤相同。

不要直接在这台服务器执行默认的 `docker compose up -d`：项目原有 `nginx` 服务会申请 80/443。后文创建的 `zd-compose` 命令会自动加载本机专用覆盖配置，避免这一冲突。

主站选用不带 `www` 的规范地址：`https://bjzdbuilding.com`。`www` 通过 HTTPS 跳转到这个地址。

## 2. 核对服务器与现有 GitLab

### 2.1 Windows 连接 ECS

在 Windows PowerShell 执行：

```powershell
ssh root@43.110.24.91
```

如果云控制台要求 SSH 私钥，使用实际的私钥路径登录，不要把私钥或服务器密码写入仓库。

### 2.2 在 ECS 核对系统、磁盘和入口程序

```bash
cat /etc/os-release
```

```bash
uname -m
```

```bash
free -h
```

```bash
df -h / /var/lib/docker
```

```bash
gitlab-ctl status nginx
```

```bash
test -f /etc/gitlab/gitlab.rb && echo '发现 GitLab Linux 安装包配置'
```

```bash
command -v gitlab-ctl
```

```bash
ss -lntp | grep -E ':(80|443|13000|11337)\b'
```

默认步骤要求 `/etc/gitlab/gitlab.rb` 存在，`gitlab-ctl status nginx` 显示运行中，且 13000 / 11337 未被占用。若 GitLab 命令不存在，先按第 15 节判断独立 Nginx，不要安装第二套 Nginx 抢占 80 端口。

128 GB 内存足够容纳本项目的单机部署，但仍要给现有 GitLab 留出磁盘与计算资源。部署前建议有至少约 30 GB 可用磁盘作为构建和日志余量；这是本教程的操作预留值，后续容量取决于图片、询盘、GitLab 仓库和备份增长。

### 2.3 保存现有 GitLab 配置

```bash
gitlab-ctl backup-etc
```

记录生成的备份路径。后续只给现有 Nginx 增加网站虚拟主机，不修改 GitLab 的 `external_url`、现有 Git 仓库路径或 Ruby 8080 监听配置。

## 3. 配置 ECS 安全组

在阿里云 ECS 控制台选择**这台实例的实际地域**，进入实例 → 安全组 → 入方向规则。

| 协议 / 端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 | 管理人员当前公网 IP `/32` 或已有办公出口网段 | SSH 管理；保留已有可用登录规则 |
| TCP 80 | `0.0.0.0/0` | HTTP 跳转、证书 HTTP 验证、现有 GitLab |
| TCP 443 | `0.0.0.0/0` | 网站、后台 HTTPS |

本教程不需要对公网开放 3000、1337、13000、11337、19000、5432、9000、9001 或 8080。应用和 MinIO API 端口仅绑定 `127.0.0.1`；数据库不发布宿主机端口；MinIO Web 控制台关闭，管理通过受控命令执行。

如果服务器另有 UFW / 主机防火墙，检查现有规则并允许 80/443；先保证 SSH 规则正确，再调整防火墙。不要直接重置现有 GitLab 服务器的防火墙。

参考：[阿里云 ECS 安全组说明](https://www.alibabacloud.com/help/zh/ecs/user-guide/start-using-security-groups)。

## 4. 安装工具，确认 Docker Compose

### 4.1 安装基础工具

```bash
apt-get update
```

```bash
apt-get install -y git curl ca-certificates openssl dnsutils python3
```

```bash
docker version
```

```bash
docker compose version
```

```bash
docker buildx version
```

三个 Docker 命令正常时，跳到 4.3。服务器已经可以运行 `docker ps`，不要为了套用教程卸载现有 Docker。

### 4.2 仅在 Docker / Compose 缺失时安装

先查看现有安装来源：

```bash
dpkg -l | grep -E 'docker|containerd|runc'
```

如果已有其他来源的 Docker，按照 [Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/) 处理安装来源，不在现有服务上盲目混装。

以下是使用 Docker 官方 APT 仓库的安装命令，适用于尚未安装或已确认使用该仓库的服务器：

```bash
install -m 0755 -d /etc/apt/keyrings
```

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
```

```bash
chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```bash
apt-get update
```

```bash
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

```bash
systemctl enable --now docker
```

```bash
docker compose version
```

### 4.3 安装证书工具

检查是否已有 Certbot：

```bash
command -v certbot
```

本教程后续使用 Certbot 官方推荐的 Snap 安装，命令固定写为 `/snap/bin/certbot`。已有其他安装时先核对已有证书和续期任务，再按官方说明选择一种安装渠道，避免重复续期任务。

```bash
apt-get install -y snapd
```

```bash
snap install --classic certbot
```

```bash
/snap/bin/certbot --version
```

这里采用 `certonly --webroot`，不会让 Certbot 自动改写 GitLab 的 Nginx 配置，也不需要停止现有 80 端口。

参考：[Certbot 安装](https://certbot.eff.org/instructions?os=snap&ws=nginx)、[Certbot webroot 与续期说明](https://eff-certbot.readthedocs.io/en/stable/using.html)。

## 5. 准备 MinIO 持久化存储

本方案使用 `docker-compose.yml` + `docker-compose.minio.yml` + 本机入口覆盖文件。MinIO 和客户端从固定上游源码版本构建，无需继续使用 VM 中的第三方旧镜像，也不需要开通 OSS。

### 5.1 版本与目录

MinIO 服务端固定为 `RELEASE.2025-10-15T17-29-55Z`，客户端固定为 `RELEASE.2025-08-13T08-35-41Z`，构建源为 `deploy/minio/Dockerfile`。上游社区仓库已经归档；这是按你选择自建社区版的部署方式，镜像构建成功不代表上游持续提供维护。后续升级与漏洞评估需要单独跟进。

参考：[MinIO 官方仓库现状](https://github.com/minio/minio)、[固定服务端安全版本](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)。

默认数据目录为 `/srv/zhuduo/minio-data`，只用于这套正式环境。在 ECS 逐条执行：

```bash
install -d -m 0755 /srv/zhuduo
```

```bash
install -d -o 10001 -g 10001 -m 0700 /srv/zhuduo/minio-data
```

```bash
df -h /srv/zhuduo/minio-data
```

容器以 UID/GID `10001:10001` 写入该目录。若有独立数据盘，先确认数据盘已按 UUID 持久挂载到预定路径，再创建目录；不要在未挂载的数据盘路径下误写系统盘。不执行格式化磁盘命令。目录权限仅针对本次新建空目录设置，已有 MinIO 数据不要直接移动或覆盖。

图片增长主要占用磁盘。128 GB 是内存容量，不代表磁盘可用空间；同时监控 MinIO 数据盘和 Docker 构建盘。

### 5.2 账号与媒体桶

第 7 节会生成两组独立账号：

| 用途 | 配置 | 权限 |
| --- | --- | --- |
| 存储管理 | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | 仅用于初始化与受控管理，不注入 CMS / Web |
| CMS 图片上传 | `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 限定到 `zhuduo-media` 桶内的对象读写及必要的列举操作 |

`minio-init` 会创建 `zhuduo-media`、CMS 账号和权限策略。匿名访问只允许 `GetObject`，不允许列举桶、上传或删除。该桶专门保存公开产品图片；客户询盘、私有附件、密钥、备份不放在其中。

### 5.3 媒体地址

本方案使用以下地址，后续将一起配置 DNS 和证书：

```dotenv
S3_ENDPOINT=http://minio:9000
S3_BUCKET=zhuduo-media
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ROOT_PATH=
MEDIA_PUBLIC_URL=https://media.bjzdbuilding.com/zhuduo-media
```

`S3_REGION=us-east-1` 是此自建 MinIO 的签名区域，与阿里云 ECS 的实际地域无需同名。CMS 经容器内网上传；浏览器读取地址需要包含桶路径 `/zhuduo-media`，例如 `https://media.bjzdbuilding.com/zhuduo-media/图片文件.webp`。

CMS 和初始化任务使用内部 `storage` 网络连接 MinIO。MinIO 还连接一个仅自身加入的普通桥接网络 `storage_host`，用于发布 `127.0.0.1:19000`；Docker 不会为只连接内部网络的容器实际发布宿主机端口。

保持以上桶名和公开路径一致。若自行更改桶名，需要同步修改 `.env`、第 11 节 Nginx 的路径和备份源。MinIO 管理接口不通过媒体域名公开。

## 6. 拉取 main 分支代码

以下按全新目录 `/opt/www/web` 部署。如果该目录已经存在，先确认现有代码、`.env` 与数据用途，不覆盖已有目录。

```bash
mkdir -p /opt/www
```

```bash
git clone --branch main --single-branch http://43.110.24.91/zd/web.git /opt/www/web
```

按提示输入有仓库读取权限的 GitLab 用户名与密码 / 令牌；可以使用具备 `read_repository` 权限的部署凭据。Windows 上保存的 Git 登录信息不会自动出现在 ECS 上。不要把令牌写入 clone URL。

```bash
cd /opt/www/web
```

```bash
git branch --show-current
```

应显示 `main`。

```bash
git log -1 --oneline
```

记录此版本用于部署验收和回退。代码拉取不包含 VM 中的 PostgreSQL 数据或 MinIO 上传文件；现有内容的迁移见第 13 节。

## 7. 创建正式环境配置和本机覆盖配置

### 7.1 自动生成独立密钥

在 `/opt/www/web` 执行下面完整代码块。它会读取仓库的 `.env.example`，生成生产配置与独立随机密钥；如果 `.env` 已存在，会停止，不覆盖已有密钥。

```bash
python3 - <<'PY'
from pathlib import Path
import os
import secrets
import subprocess

target = Path('.env')
if target.exists():
    raise SystemExit('.env 已存在，请直接编辑，不要重新生成并覆盖现有密钥。')

values = {
    'SITE_DOMAIN': 'bjzdbuilding.com',
    'CMS_DOMAIN': 'cms.bjzdbuilding.com',
    # base Compose 会检查该值；本方案不启动容器 nginx。
    'TLS_CERTS_DIR': '/etc/letsencrypt',
    'RELEASE_TAG': subprocess.check_output(
        ['git', 'rev-parse', '--short', 'HEAD'], text=True
    ).strip(),
    'POSTGRES_DB': 'modular_housing',
    'POSTGRES_USER': 'modular_housing',
    'POSTGRES_PASSWORD': secrets.token_hex(32),
    'APP_KEYS': ','.join(secrets.token_hex(32) for _ in range(2)),
    'MEDIA_PUBLIC_URL': 'https://media.bjzdbuilding.com/zhuduo-media',
    'S3_ENDPOINT': 'http://minio:9000',
    'S3_BUCKET': 'zhuduo-media',
    'S3_REGION': 'us-east-1',
    'S3_FORCE_PATH_STYLE': 'true',
    'MINIO_DATA_DIR': '/srv/zhuduo/minio-data',
    'MINIO_ROOT_USER': 'zhuduo-storage-admin',
    'MINIO_ROOT_PASSWORD': secrets.token_hex(32),
    'S3_ACCESS_KEY': 'zhuduo-cms-media',
    'S3_SECRET_KEY': secrets.token_hex(32),
    'AUTO_TRANSLATE_ENABLED': 'false',
}
for key in (
    'ADMIN_JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT',
    'ENCRYPTION_KEY', 'STRAPI_SERVER_TOKEN',
):
    values[key] = secrets.token_hex(32)

lines = []
for line in Path('.env.example').read_text(encoding='utf-8').splitlines():
    key = line.split('=', 1)[0] if line and not line.startswith('#') else None
    lines.append(f'{key}={values[key]}' if key in values else line)
os.umask(0o077)
with target.open('x', encoding='utf-8') as stream:
    stream.write('\n'.join(lines) + '\n')
target.chmod(0o600)
print('已生成 .env 和独立 MinIO/CMS 凭据；密钥未打印。')
PY
```

随后编辑：

```bash
nano .env
```

生成脚本已经填写 MinIO 参数，无需购买或填写 OSS 凭据。核对以下非机密项目；密码保留脚本生成值，不要替换成示例文字：

```dotenv
S3_ENDPOINT=http://minio:9000
S3_BUCKET=zhuduo-media
S3_ACCESS_KEY=zhuduo-cms-media
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ROOT_PATH=
MEDIA_PUBLIC_URL=https://media.bjzdbuilding.com/zhuduo-media
MINIO_DATA_DIR=/srv/zhuduo/minio-data
MINIO_ROOT_USER=zhuduo-storage-admin
```

保留自动生成的其他密钥。`APP_KEYS` 已包含两个不同的随机值，用英文逗号隔开；`STRAPI_SERVER_TOKEN` 会同时注入 Web 与 CMS，无需从 Strapi 后台另建同名 Token。

当前没有翻译接口，保持 `AUTO_TRANSLATE_ENABLED=false`。验证码未配置时，将 `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY` 和 `TURNSTILE_EXPECTED_HOSTNAME` 一并留空。

`POSTGRES_PASSWORD` 是数据库首次初始化使用的密码；已有数据库后，修改 `.env` 不会自动修改数据库内部密码。`ENCRYPTION_KEY` 等密钥需要单独安全备份。

### 7.2 覆盖应用监听地址，禁用容器入口

```bash
install -d -m 0755 /etc/zhuduo
```

```bash
cat > /etc/zhuduo/docker-compose.ecs-host.yml <<'YAML'
services:
  cms:
    ports:
      - '127.0.0.1:11337:1337'
  web:
    ports:
      - '127.0.0.1:13000:3000'
  nginx:
    profiles: ['standalone-gateway']
YAML
```

这里的 `nginx` profile 默认不启用。后续启动 `postgres cms web` 时会自动启动所需的 MinIO 和初始化任务。

### 7.3 创建固定的生产操作命令

```bash
cat > /usr/local/bin/zd-compose <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec docker compose \
  --project-directory /opt/www/web \
  --env-file /opt/www/web/.env \
  -f /opt/www/web/docker-compose.yml \
  -f /opt/www/web/docker-compose.minio.yml \
  -f /etc/zhuduo/docker-compose.ecs-host.yml \
  "$@"
SH
```

```bash
chmod 0755 /usr/local/bin/zd-compose
```

```bash
zd-compose config --quiet
```

成功时没有输出。缺少必填变量会直接报出变量名；回到 `.env` 补齐后再执行。

常规操作使用 `config --quiet`。完整 `config` 可能展开密码等运行时变量，不要把其完整输出公开粘贴。

## 8. 构建并启动应用

### 8.1 拉取数据库镜像，构建存储与应用镜像

```bash
cd /opt/www/web
```

```bash
zd-compose pull postgres
```

```bash
zd-compose build minio
```

```bash
zd-compose build minio-init
```

```bash
zd-compose build cms
```

```bash
zd-compose build web
```

首次构建会下载 Linux Go / Node / Alpine 镜像、MinIO 源码依赖和 npm 依赖，存储源码编译可能需要数分钟。不要把 Windows 的二进制、`node_modules`、`.next` 或 `dist` 复制到服务器替代 Linux 构建。

### 8.2 启动数据库、后台和网站

```bash
zd-compose up -d --wait --wait-timeout 600 postgres cms web
```

```bash
zd-compose ps
```

应看到 `postgres`、`minio`、`cms`、`web` 为 running / healthy；`minio-init` 为 Exited (0)，这是正常完成的一次性任务。用 `zd-compose ps -a` 可查看它。应用和 MinIO 的宿主端口应绑定为 `127.0.0.1`，不应有本项目的 `nginx` 容器占用 80/443。

```bash
curl --fail http://127.0.0.1:19000/minio/health/ready
```

```bash
curl --fail http://127.0.0.1:11337/api/health
```

```bash
curl --fail http://127.0.0.1:13000/api/health
```

如果失败，先看日志：

```bash
zd-compose logs --no-color --tail=100 cms
```

```bash
zd-compose logs --no-color --tail=100 web
```

此时应用已经在本机启动，但尚未切换正式域名。

### 8.3 MinIO 健康，但 19000 端口连接被拒绝

如果容器内健康接口返回 HTTP 200，`docker inspect` 中 `HostConfig.PortBindings` 有 `19000`，但 `NetworkSettings.Ports` 的 `9000/tcp` 为 `null`，说明 Docker 没有实际发布端口。旧版配置只把 MinIO 连接到 `internal: true` 网络，会出现这个问题。参见 [Moby 上游的同类问题与复现](https://github.com/moby/moby/discussions/53256)。

先拉取已合入 `main` 的修复配置：

```bash
git pull --ff-only origin main
```

确认 `docker-compose.minio.yml` 中 MinIO 同时连接 `storage` 和 `storage_host`。保持 `.env` 中 `RELEASE_TAG` 为当前已构建的应用版本，这次仅调整 MinIO 网络，不需要重建镜像。仅重新创建 MinIO 容器：

```bash
zd-compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 minio
```

这会短暂中断媒体请求，已有持久化数据目录继续挂载。随后验证宿主机访问：

```bash
curl --fail --silent --show-error --output /dev/null --write-out 'HTTP %{http_code}\n' http://127.0.0.1:19000/minio/health/ready
```

```bash
zd-compose ps
```

健康接口应返回 `HTTP 200`，MinIO 的端口列应出现 `127.0.0.1:19000->9000/tcp`。确认后继续第 9 步。不需要为此开放公网 19000，也不需要修改 MinIO 或数据库密码。

## 9. 给现有 GitLab Nginx 加入网站入口

### 9.1 创建 HTTP 验证目录和临时网站配置

```bash
install -d -m 0755 /var/www/letsencrypt/.well-known/acme-challenge
```

```bash
install -d -m 0755 /etc/zhuduo/nginx
```

```bash
cat > /etc/zhuduo/nginx/website.conf <<'NGINX'
log_format zhuduo_safe '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';

server {
    listen 80;
    server_name bjzdbuilding.com www.bjzdbuilding.com cms.bjzdbuilding.com media.bjzdbuilding.com;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    error_log /var/log/gitlab/nginx/zhuduo_error.log warn;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
    }
    location / {
        default_type text/plain;
        return 503 "Website deployment in progress. Please try again shortly.\n";
    }
}
NGINX
```

该配置只处理四个网站域名；GitLab 的 IP 地址虚拟主机继续按原配置服务。

### 9.2 在 GitLab 的 http 配置中加入 include

```bash
nano /etc/gitlab/gitlab.rb
```

查找 `custom_nginx_config`。如果没有现有配置，增加这一行：

```ruby
nginx['custom_nginx_config'] = 'include /etc/zhuduo/nginx/*.conf;'
```

如果已经存在 `nginx['custom_nginx_config']`，把 `include /etc/zhuduo/nginx/*.conf;` 追加到**原字符串内部**，保留原有内容，不用第二次赋值覆盖原字符串。也不要覆盖已经由现有 include 管理的其他站点。

保存后执行：

```bash
gitlab-ctl reconfigure
```

```bash
/opt/gitlab/embedded/sbin/nginx -t -p /var/opt/gitlab/nginx -c /var/opt/gitlab/nginx/conf/nginx.conf
```

```bash
gitlab-ctl hup nginx
```

先验证 GitLab 仍然可访问：

```bash
curl -I http://43.110.24.91/users/sign_in
```

参考：[GitLab 自带 Nginx 插入自定义 server 配置](https://docs.gitlab.com/omnibus/settings/nginx/#insert-custom-settings-into-the-nginx-configuration)。

### 9.3 在切换 DNS 前测试 HTTP 验证路径

```bash
printf 'zhuduo-acme-ok\n' > /var/www/letsencrypt/.well-known/acme-challenge/zhuduo-check
```

```bash
chmod 0644 /var/www/letsencrypt/.well-known/acme-challenge/zhuduo-check
```

```bash
curl --fail --resolve bjzdbuilding.com:80:127.0.0.1 http://bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

```bash
curl --fail --resolve www.bjzdbuilding.com:80:127.0.0.1 http://www.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

```bash
curl --fail --resolve cms.bjzdbuilding.com:80:127.0.0.1 http://cms.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

增加媒体域名检查：

```bash
curl --fail --resolve media.bjzdbuilding.com:80:127.0.0.1 http://media.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

四条均应输出 `zhuduo-acme-ok`。然后在 Windows PowerShell 用公网路径再测一次：

```powershell
curl.exe --fail --resolve bjzdbuilding.com:80:43.110.24.91 http://bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

公网测试失败时先检查安全组、主机防火墙和 Nginx include，不要直接切换主域 DNS。

## 10. 在阿里云配置域名解析

### 10.1 已发现的现有解析

2026-10-15 查询时，权威 NS 为 `dns13.hichina.com` / `dns14.hichina.com`；主域 A 记录返回 `216.198.79.1`，`www` 指向 `8e33bdbc5fd02e1c.vercel-dns-017.com`，`cms` 尚未解析。这是当时的查询结果，操作前在控制台重新核对。

Vercel 仅用于临时展示，正式环境使用 ECS。按照你的选择，解除 Vercel 的域名绑定并将解析切换到 ECS，不把 Vercel 作为正式回退环境。不用重新购买或迁移域名注册商。如果之后已更换 NS，则要在当前权威 DNS 服务商处修改记录。

### 10.2 准备切换

在阿里云控制台 → 云解析 DNS → `bjzdbuilding.com` → 解析设置。

如果计划维护窗口，提前把现有站点记录的 TTL 调低至控制台允许的较低值，例如 600 秒，并等待旧 TTL 经过。TTL 不是全球同时生效的倒计时，不同访问者可能暂时访问到不同地址。

第 8 / 9 步通过后，按以下顺序切换：

1. 在 Vercel 对应项目 → Settings → Domains，删除 `bjzdbuilding.com` 与 `www.bjzdbuilding.com` 的临时展示绑定；如果还有网站子域绑定，同样核对并移除。
2. 在阿里云 DNS 按下一节修改 `@` 和 `www`，增加 `cms` 和 `media`。**Vercel 解绑不会自动删除或修改阿里云中的 A / CNAME 记录。**
3. 等待解析更新，通过 HTTP 验证路径后继续申请证书并启用 HTTPS。

解绑后、DNS 缓存更新与 HTTPS 配置完成前，可能短暂看到旧平台的域名错误或新服务器的维护提示；临时展示允许这个切换窗口。正式站点的后续更新与回退都在 ECS 完成。

参考：[Vercel 移除项目域名](https://vercel.com/docs/domains/working-with-domains/remove-a-domain)。

### 10.3 目标记录表

| 主机记录 | 类型 | 记录值 | 用途 |
| --- | --- | --- | --- |
| `@` | A | `43.110.24.91` | 主站 |
| `www` | CNAME | `bjzdbuilding.com` | `www` 到同一服务器，再由 Nginx 跳转 |
| `cms` | A | `43.110.24.91` | Strapi 后台 |
| `media` | A | `43.110.24.91` | MinIO 图片的 HTTPS 入口 |

操作要点：

1. 把原 `@` 的站点 A 记录修改成 `43.110.24.91`，不要额外留下指向旧站的另一个站点 A 记录。
2. 把原 `www` 的 Vercel CNAME 改为 `bjzdbuilding.com`；同一个主机记录不要同时保留冲突的 A 和 CNAME。
3. 新增 `cms` 和 `media` 的 A 记录。
4. 如 `media` 原来有 OSS 或其他平台的 CNAME，先移除冲突记录；本方案使用指向 ECS 的 A 记录。
5. 本教程按 IPv4 部署；若 `@` / `www` / `cms` / `media` 还有旧站 AAAA 记录，需移除或更新为真实已配置的 IPv6 服务，避免部分用户和证书验证走到旧站。
6. 邮箱的 MX、SPF、DKIM、DMARC 及其他业务 TXT 记录保持原配置，不为部署网站而删除。
7. 记录值不包含 `http://`、`https://`、端口或路径。

### 10.4 检查解析

回到 ECS：

```bash
dig +short A bjzdbuilding.com
```

```bash
dig +short A www.bjzdbuilding.com
```

```bash
dig +short A cms.bjzdbuilding.com
```

应最终解析到 `43.110.24.91`；`www` 可能先输出 CNAME，再输出 IP。

```bash
dig +short AAAA bjzdbuilding.com
```

```bash
dig +short CAA bjzdbuilding.com
```

没有配置 IPv6 时，主域 AAAA 应为空。如果已有 CAA 限定签发机构，需要允许本教程使用的 Let's Encrypt（`letsencrypt.org`）。没有 CAA 记录不要求为了本教程额外添加。

```bash
curl --fail http://bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

```bash
curl --fail http://www.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

```bash
curl --fail http://cms.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

再检查媒体域名：

```bash
dig +short A media.bjzdbuilding.com
```

```bash
curl --fail http://media.bjzdbuilding.com/.well-known/acme-challenge/zhuduo-check
```

四个域名均通过后申请证书。也从 Windows / 外部网络复查一次，避免只检查服务器本地缓存。

参考：[阿里云 DNS 添加与修改解析记录](https://www.alibabacloud.com/help/en/dns/pubz-add-parsing-record)。

### 10.5 美国地域与备案

按阿里云当前说明，网站使用中国大陆以外服务器时，不需要为该境外主机申请中国大陆网站 ICP 备案。若后续改用中国大陆 ECS 或接入有备案要求的中国大陆服务，应按对应产品要求办理。本教程的 ECS 地域应以控制台实际配置为准；MinIO 使用该 ECS 的数据盘。

参考：[阿里云：ICP备案与域名解析](https://www.alibabacloud.com/help/en/dns/icp-and-dns)。

## 11. 申请并启用网站 HTTPS

### 11.1 申请主站、www、后台和媒体域名的证书

在 ECS 执行：

```bash
/snap/bin/certbot certonly --webroot -w /var/www/letsencrypt --cert-name bjzdbuilding.com -d bjzdbuilding.com -d www.bjzdbuilding.com -d cms.bjzdbuilding.com -d media.bjzdbuilding.com
```

按提示填写真实的运维邮箱并阅读、接受证书服务条款。成功后生成：

```text
/etc/letsencrypt/live/bjzdbuilding.com/fullchain.pem
/etc/letsencrypt/live/bjzdbuilding.com/privkey.pem
```

这张证书覆盖四个 ECS 域名，包括 MinIO 图片域名 `media.bjzdbuilding.com`；均由同一套 Certbot 续期。

### 11.2 安装代理片段

```bash
install -m 0644 /opt/www/web/deploy/nginx/proxy-common.conf /etc/zhuduo/proxy-common.conf
```

```bash
install -m 0644 /opt/www/web/deploy/nginx/security-headers.conf /etc/zhuduo/security-headers.conf
```

这些片段覆盖客户端伪造的转发头，并清空来自外部的 `X-Inquiry-Client`。Next.js 再通过内部网络携带服务密钥向 CMS 保存询盘。

### 11.3 替换为完整 HTTPS 配置

首次管理员创建前，先把整个 CMS 域名限制为仅当前办公公网 IP 可访问，避免其他人抢先注册。只限制 `/admin` 页面不够，注册接口也必须覆盖。先在你自己的 Windows PowerShell 查询当前出口 IPv4，并记下结果：

```powershell
curl.exe -4 https://api.ipify.org
```

这是当前电脑的公网 IP，不是 ECS 的 `43.110.24.91`，也不是 VM 的 `192.168.200.7`。如果使用代理，查询和打开后台时应保持相同出口。

先保存临时配置，备份文件的扩展名不要以 `.conf` 结尾，避免被 include 重复加载：

```bash
cp /etc/zhuduo/nginx/website.conf /etc/zhuduo/nginx/website.conf.http-backup
```

```bash
cat > /etc/zhuduo/nginx/website.conf <<'NGINX'
log_format zhuduo_safe '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';

server {
    listen 80;
    server_name bjzdbuilding.com www.bjzdbuilding.com cms.bjzdbuilding.com media.bjzdbuilding.com;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    error_log /var/log/gitlab/nginx/zhuduo_error.log warn;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
    }
    location / {
        return 308 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name www.bjzdbuilding.com;
    ssl_certificate /etc/letsencrypt/live/bjzdbuilding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bjzdbuilding.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /etc/zhuduo/security-headers.conf;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    return 308 https://bjzdbuilding.com$request_uri;
}

server {
    listen 443 ssl;
    server_name bjzdbuilding.com;
    ssl_certificate /etc/letsencrypt/live/bjzdbuilding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bjzdbuilding.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /etc/zhuduo/security-headers.conf;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    error_log /var/log/gitlab/nginx/zhuduo_error.log warn;
    client_max_body_size 64k;

    location / {
        include /etc/zhuduo/proxy-common.conf;
        proxy_pass http://127.0.0.1:13000;
    }
}

server {
    listen 443 ssl;
    server_name cms.bjzdbuilding.com;
    # ZHUDUO_INITIAL_ADMIN_BEGIN
    allow 127.0.0.1;
    # allow 替换为你的办公公网IPv4;
    deny all;
    # ZHUDUO_INITIAL_ADMIN_END
    ssl_certificate /etc/letsencrypt/live/bjzdbuilding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bjzdbuilding.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /etc/zhuduo/security-headers.conf;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    error_log /var/log/gitlab/nginx/zhuduo_error.log warn;
    client_max_body_size 25m;

    location ~ ^/api/inquiries/submit(?:/|$) {
        return 403;
    }
    location / {
        include /etc/zhuduo/proxy-common.conf;
        proxy_pass http://127.0.0.1:11337;
    }
}

server {
    listen 443 ssl;
    server_name media.bjzdbuilding.com;
    ssl_certificate /etc/letsencrypt/live/bjzdbuilding.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bjzdbuilding.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /etc/zhuduo/security-headers.conf;
    access_log /var/log/gitlab/nginx/zhuduo_access.log zhuduo_safe;
    error_log /var/log/gitlab/nginx/zhuduo_error.log warn;

    # Preserve the bucket path; expose only object GET / HEAD requests.
    location ^~ /zhuduo-media/ {
        limit_except GET { deny all; }
        include /etc/zhuduo/proxy-common.conf;
        proxy_set_header Authorization "";
        proxy_set_header Cookie "";
        proxy_hide_header Set-Cookie;
        proxy_pass http://127.0.0.1:19000;
    }
    location / { return 403; }
}
NGINX
```

在 ECS 编辑刚生成的配置：

```bash
nano /etc/zhuduo/nginx/website.conf
```

找到 `# allow 替换为你的办公公网IPv4;`，去掉开头的 `#`，把占位文字替换为前面查询到的真实 IPv4，保留末尾分号。例如格式为 `allow 你的真实公网IPv4;`。保留 `allow 127.0.0.1;` 和 `deny all;`。保存后退出；未添加实际办公 IP 时，远程后台会返回 403。

先检查，成功后才平滑加载：

```bash
/opt/gitlab/embedded/sbin/nginx -t -p /var/opt/gitlab/nginx -c /var/opt/gitlab/nginx/conf/nginx.conf
```

```bash
gitlab-ctl hup nginx
```

如果 Nginx 检查失败，不执行 reload；根据错误修复新配置，或先把 `website.conf.http-backup` 复制回 `website.conf` 后重新检查。

### 11.4 检查 HTTPS 与跳转

```bash
curl --fail https://bjzdbuilding.com/api/health
```

```bash
curl --fail --resolve cms.bjzdbuilding.com:443:127.0.0.1 https://cms.bjzdbuilding.com/api/health
```

```bash
curl -I https://www.bjzdbuilding.com
```

应看到 `www` 返回 308，`Location` 指向 `https://bjzdbuilding.com`。

```bash
curl -I http://43.110.24.91/users/sign_in
```

确认原 GitLab 仍然可访问。然后在刚才允许的办公 IP 下，在浏览器打开：

```text
https://bjzdbuilding.com
https://bjzdbuilding.com/?lang=zh
https://cms.bjzdbuilding.com/admin
```

媒体域名只代理 `/zhuduo-media/` 下的 GET / HEAD；不对公网开放 S3 写入和管理路径。`proxy_pass` 后没有额外的 `/`，以保留桶路径。上传由 CMS 经容器内网完成。可检查被禁止的管理路径：

```bash
curl -I https://media.bjzdbuilding.com/minio/health/ready
```

此地址应返回 403；真实图片在第 12 节上传后验证。不要因为它返回 403 而开放整个 MinIO 根路径。

### 11.5 配置证书续期后的 Nginx reload

证书采用 webroot 签发，后续仍通过现有 Nginx 的 HTTP 验证目录续期，不停止 80/443 服务。

```bash
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
```

```bash
cat > /etc/letsencrypt/renewal-hooks/deploy/zhuduo-nginx <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${RENEWED_LINEAGE:-}" != /etc/letsencrypt/live/bjzdbuilding.com ]]; then
  exit 0
fi
/opt/gitlab/embedded/sbin/nginx -t \
  -p /var/opt/gitlab/nginx \
  -c /var/opt/gitlab/nginx/conf/nginx.conf
/usr/bin/gitlab-ctl hup nginx
SH
```

```bash
chmod 0750 /etc/letsencrypt/renewal-hooks/deploy/zhuduo-nginx
```

测试加载脚本：

```bash
RENEWED_LINEAGE=/etc/letsencrypt/live/bjzdbuilding.com /etc/letsencrypt/renewal-hooks/deploy/zhuduo-nginx
```

测试证书续期：

```bash
/snap/bin/certbot renew --cert-name bjzdbuilding.com --dry-run
```

查看自动续期定时任务：

```bash
systemctl list-timers --all | grep -i certbot
```

若服务器现有 CAA、DNS、80 端口路由或媒体 HTTPS 发生变更，分别重新检查相应证书。四个域名都需保持可通过 HTTP 验证，媒体证书随此证书一起更新。

## 12. 初始化中文后台、产品和 FAQ

### 12.1 创建正式管理员

首次打开 `https://cms.bjzdbuilding.com/admin`，创建生产管理员。生产数据库和 VM 数据库分开；如果采用 Strapi 内容导入，也要核对生产管理员，因为 Strapi 内容导出不包含管理员账号和 API Token。

确认已成功创建管理员、退出后能够重新登录，再解除临时访问限制。在 ECS 执行：

```bash
nano /etc/zhuduo/nginx/website.conf
```

删除 `# ZHUDUO_INITIAL_ADMIN_BEGIN` 到 `# ZHUDUO_INITIAL_ADMIN_END` 之间的整段临时 `allow` / `deny` 配置，包括两行标记，保留 CMS 的其他配置。

```bash
/opt/gitlab/embedded/sbin/nginx -t -p /var/opt/gitlab/nginx -c /var/opt/gitlab/nginx/conf/nginx.conf
```

```bash
gitlab-ctl hup nginx
```

语法检查成功后才执行上述平滑加载。然后核对公开健康接口：

```bash
curl --fail https://cms.bjzdbuilding.com/api/health
```

后台已支持简体中文。已有账户如仍显示英文，进入头像 → Profile / 个人资料 → Interface language / 界面语言，选择“中文（简体）”并保存。

### 12.2 添加内容语言

在 Settings → Internationalization 添加并核对：

- `en`：英语。
- `zh-Hans`：简体中文。

界面语言和内容语言是两件事。管理员使用中文界面，不会自动生成产品的中文内容。

初始 `Operations` 角色只包含其创建时已有语言的权限；后来添加 `zh-Hans` 后，超级管理员要在该角色权限中补齐中文范围的读取、创建、编辑、删除、发布权限。

### 12.3 准备公司五款产品

正式环境 `SEED_DEMO_CONTENT=false`，不会自动导入 VM 的产品或演示 FAQ。选择第 13 节迁移现有内容，或手动建立并发布下列中英文内容：

| 产品 slug | 产品 |
| --- | --- |
| `expandable-20ft` | 20FT 扩展式集装箱房 |
| `expandable-30ft` | 30FT 扩展式集装箱房 |
| `expandable-40ft` | 40FT 扩展式集装箱房 |
| `expandable-20ft-mini` | 20FT MINI 扩展式集装箱房 |
| `space-capsule-d7` | D7 太空舱 |

文案、参数和出处在仓库 `packages/contracts/company-products.json`。产品宣传图片已随前台部署到 `/products/…webp`；按文件中的 `imageUrl` 使用即可。Strapi 上传到 `image` 字段的新图片会优先显示。

两种语言分别发布；FAQ 和 Site Setting 同样检查中英文发布状态。配置公司实际联系邮箱和页脚文案。当前没有翻译接口，英文发布不会自动翻译中文。

网站内容有约 30 秒缓存，发布后稍等再刷新。若产品或 FAQ 为空，优先检查该语言是否真的有已发布记录，不要通过开启开发 seed 来修复生产内容。

### 12.4 完成上线验收

按浏览器实际操作核对：

1. 主站和中文页均可打开，产品为四款扩展房和 D7，移除的太空舱没有重新出现。
2. 中英文 FAQ、公司邮箱和页脚正确。
3. `www` 自动跳转到主域名，没有证书提示。
4. 管理员可登录后台，后台静态资源正常加载。
5. 在后台上传一张图片，网页和媒体地址均能读取；再测试替换 / 删除不再使用的测试图片。
6. 从网站提交一条可识别的测试询盘，成功弹窗为“感谢您的咨询，我们会尽快与您联系。”；在后台确认确实入库，再由管理员处理测试记录。
7. 询盘产品方向下拉框和语言切换正常。
8. 执行下列重启后，产品、FAQ、询盘和上传图片仍在。

```bash
zd-compose restart cms web
```

```bash
zd-compose ps
```

等待两个应用再次 healthy 后复查页面。询盘当前保存到后台，不代表自动发送邮件；SMTP / 销售消息通知不是这次部署自动配置的功能。

上传图片的实际 URL 应以 `https://media.bjzdbuilding.com/zhuduo-media/` 开头。检查一张真实已上传图片的 GET / HEAD 与下载；桶根路径的列举应失败。不要通过手工改数据库 URL 来掩盖存储配置错误。

### 12.5 查看 MinIO 状态与管理

MinIO Web 控制台已关闭，不必为管理开放 9001 或额外购买域名。需要查看存储信息时，在 ECS 执行下面完整代码块；凭据从容器运行环境读取，不写入命令字面量：

```bash
zd-compose run --rm --no-deps --entrypoint /bin/sh minio-init -ec '
  mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  exec mc admin info local
'
```

查看初始化失败原因：

```bash
zd-compose logs --no-color --tail=100 minio minio-init
```

不要删除 `/srv/zhuduo/minio-data` 或开发 / 生产数据库来解决登录问题。存储凭据需要轮换时，先更新受保护的 `.env`，重新运行初始化并重建受影响的容器，随后复查 CMS 上传、读取和删除；不要复用管理账号作为 CMS 账号。

## 13. 可选：把现有 VM 的内容搬到 ECS

如果希望保留已经编辑过的产品、FAQ、语言和上传图片，不能只 `git clone`。优先使用 Strapi 自带的内容导出 / 导入，让媒体文件通过目标存储 provider 重新上传。

以下流程只用于**尚未接收正式询盘、可以整体导入的全新生产实例**。`strapi import` 会删除目标现有内容，不能把它当作向已有生产库增量追加记录的命令。

### 13.1 导出前核对版本与准备

VM 和 ECS 应使用一致的项目内容模型与 Strapi 版本。分别记录 `git log -1 --oneline`，先把 VM 更新到相同的发布代码并确认健康。数据库、MinIO 保持运行；导出期间暂停后台编辑及其他数据写入。

导出应包含内容、配置和媒体，不使用 `--exclude files`。缺少媒体会留下失效的数据库图片记录。

### 13.2 在 VM 导出

以下命令在原 VM `192.168.200.7` 的 `/opt/www/web` 执行，沿用 VM 的 Docker 权限设置：

```bash
cd /opt/www/web
```

```bash
mkdir -p .cache/migration
```

```bash
chmod 700 .cache/migration
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env stop cms web
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env run --rm --no-deps -e NODE_ENV=production cms npm --workspace @modular/cms run strapi -- export --file /workspace/.cache/migration/zhuduo --no-encrypt
```

成功时生成 `.cache/migration/zhuduo.tar.gz`。这里选未加密归档便于操作，归档可能包含询盘等非公开内容，应保持私有并通过 SSH 传输。导出有错误时先解决，不继续导入；无论导出成功与否，都恢复原 VM 应用：

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env start cms web
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env ps
```

为便于当前 `wyh` 用户通过 SCP 读取文件，在 VM 执行：

```bash
sudo chown "$(id -u):$(id -g)" .cache/migration/zhuduo.tar.gz
```

```bash
chmod 600 .cache/migration/zhuduo.tar.gz
```

### 13.3 通过 Windows 中转传输

ECS 无法直接访问 `192.168.200.7` 这个私网地址。可在能访问该 VM 的 Windows PowerShell 中执行：

```powershell
scp wyh@192.168.200.7:/opt/www/web/.cache/migration/zhuduo.tar.gz "$env:USERPROFILE\Downloads\zhuduo.tar.gz"
```

先在 ECS 建立私有接收目录：

```bash
install -d -m 0700 /opt/www/migration
```

然后回到 Windows：

```powershell
scp "$env:USERPROFILE\Downloads\zhuduo.tar.gz" root@43.110.24.91:/opt/www/migration/zhuduo.tar.gz
```

### 13.4 仅向全新目标导入

在 ECS 先确认目标数据库与 MinIO 媒体桶 / 前缀是本次新部署用途，尚无要保留的生产内容。若已经有正式内容或询盘，改用专门迁移方案，不执行以下全量导入。

```bash
chmod 600 /opt/www/migration/zhuduo.tar.gz
```

```bash
zd-compose stop cms web
```

```bash
zd-compose run --rm --no-deps --user 0:0 \
  -v /opt/www/migration:/migration:ro \
  --workdir /app/apps/cms/dist --entrypoint /bin/sh cms -ec '
    cp ../package.json ./package.json
    cp -a ../database ./database
    cp -a ../public ./public
    exec node /app/node_modules/@strapi/strapi/bin/strapi.js import --file /migration/zhuduo.tar.gz
  '
```

使用一次性容器的 root 用户，是为了读取 root 私有归档；正常 CMS 仍由镜像内的非 root 用户运行。阅读 CLI 对“删除目标内容”的提示，确认目标为本次新建实例后按提示继续，不使用跳过确认的 `--force` 参数。

生产镜像只包含编译结果，导入命令因此在 `dist` 中按 JavaScript 应用运行，并在一次性容器中补齐应用元数据、迁移和公开目录。不要直接改成默认工作目录中的 `npm run strapi -- import`，否则 CLI 可能再次尝试编译不存在的 TypeScript 源码。

无论导入成功与否，先恢复服务；导入失败时不要开放接收正式询盘，检查日志和目标内容后再处理。执行：

```bash
zd-compose up -d --wait --wait-timeout 600 postgres cms web
```

导入后在生产后台检查产品、FAQ、语言和媒体记录，确认图片 URL 已使用正式媒体域名，页面不依赖 `192.168.200.7`。自由文本中手工填写的旧绝对地址可能需要单独修改，不能认为所有文本 URL 都会被替换。

导入是上线前的独立验收项，本教程没有在你的真实数据库 / MinIO 上执行该操作。验证成功并完成正式备份后，按公司数据保留要求清理各处临时归档。

参考：[Strapi 导出](https://docs.strapi.io/cms/features/data-management/export)、[Strapi 导入](https://docs.strapi.io/cms/features/data-management/import)。

## 14. 日常更新、备份与回退

### 14.1 后台改内容

产品、FAQ 等在正式 Strapi 后台编辑并发布即可，通常不需要重建镜像。中英文分别核对发布状态。

### 14.2 网站代码更新

先按下一小节完成数据与媒体备份，记录当前代码版本和 `.env` 中的 `RELEASE_TAG`。然后在 ECS 逐条执行：

```bash
cd /opt/www/web
```

```bash
git status --short
```

如有本地源码改动，先核对用途，不直接覆盖。

```bash
git pull --ff-only origin main
```

```bash
git rev-parse --short HEAD
```

```bash
nano .env
```

将 `RELEASE_TAG` 改成刚显示的提交短编号，其他密钥保留。然后：

```bash
zd-compose config --quiet
```

```bash
zd-compose build cms
```

```bash
zd-compose build web
```

```bash
zd-compose up -d --wait --wait-timeout 600 postgres cms web
```

```bash
curl --fail https://bjzdbuilding.com/api/health
```

```bash
curl --fail https://cms.bjzdbuilding.com/api/health
```

本机网关代理固定的 loopback 端口，因此容器重建后不依赖旧容器 IP。重建期间存在应用切换窗口。若源码更新了代理片段，先审核改动，再把片段复制到 `/etc/zhuduo`，测试并 reload 现有 Nginx。

`restart` 只重启已有容器；代码或运行时环境变量变更应构建并 `up -d` 重新创建容器。改 CMS 域名必须重建 CMS，因为后台构建资源包含公开地址。

### 14.3 私有异地备份

项目已有 `deploy/backup/backup.sh`。它会暂停 CMS / Web 写入，备份 PostgreSQL 与媒体对象并验证后恢复服务；网站在该期间存在维护窗口。不能把同机磁盘副本当作唯一备份。

备份脚本需要支持 `--metadata` 的 rclone（至少 1.59）。Ubuntu 22.04 默认仓库的旧版本不满足该要求，按官方安装流程安装当前稳定版：

```bash
apt-get install -y unzip
```

```bash
curl --fail --location https://rclone.org/install.sh --output /tmp/zhuduo-rclone-install.sh
```

```bash
bash /tmp/zhuduo-rclone-install.sh
```

```bash
hash -r
```

```bash
rclone version
```

```bash
rclone help flags | grep -F -- '--metadata'
```

确认版本及 `--metadata` 参数可用后，再配置和执行备份，不要等暂停网站后才检查工具版本。

参考：[rclone 官方安装说明](https://rclone.org/install/)、[1.59 版本说明](https://rclone.org/changelog/#v1-59-0-2022-07-09)。

```bash
rclone config
```

配置本机 MinIO 源和私有异地目标两个 remote：

| remote 示例名 | 用途 |
| --- | --- |
| `minio-source` | S3 provider 选择 Minio，Endpoint 为 `http://127.0.0.1:19000`，region 为 `us-east-1`，访问 `zhuduo-media` |
| `offsite` | 独立账号 / 故障域中的私有备份 Bucket，具备备份写入与验证读取权限 |

为 `minio-source` 填入第 7 节独立 CMS 账号的 `S3_ACCESS_KEY` / `S3_SECRET_KEY`（只在本机交互配置，不公开粘贴）；该账号已限定到媒体桶，备份过程只读取源。不要填 MinIO 根账号。可进一步单独建立只有 `GetObject` / `ListBucket` 的备份读取账号。

`minio-source` 的服务端地址使用宿主 loopback，不用容器名 `minio`，也不用只允许公开读取的媒体域名。`offsite` 可以是另一台服务器的私有 MinIO 或其他私有 S3 存储，但必须与这台 ECS 分开，不能只是同机另一个桶。remote 名称不同不代表物理异地。保护 `rclone.conf` 权限。

先确认能够列举源，不打印凭据：

```bash
rclone lsf minio-source:zhuduo-media --max-depth 1
```

备份目标必须私有，不能使用 `media.bjzdbuilding.com` 的公开桶。

在维护窗口内暂停额外的上传 / 删除 / 导入写入者后，在 ECS 执行；将下列 `实际…` 占位值替换成真实路径：

```bash
cd /opt/www/web
```

```bash
export BACKUP_LOCAL_DIR=/var/backups/modular-housing
```

```bash
export BACKUP_SOURCE='minio-source:zhuduo-media'
```

```bash
export BACKUP_TARGET='offsite:实际私有备份Bucket名称/zhuduo'
```

```bash
export BACKUP_RELEASE="$(git rev-parse HEAD)"
```

```bash
export MEDIA_PUBLIC_URL=https://media.bjzdbuilding.com/zhuduo-media
```

```bash
export BACKUP_CONFIRM_WRITES_PAUSED=yes
```

```bash
bash deploy/backup/backup.sh
```

```bash
zd-compose ps
```

备份脚本按相同项目名称操作已创建容器的 stop / start，不重建应用，因此保留本教程覆盖文件创建的监听端口。备份完成后仍需确认应用健康。

备份时 MinIO 保持运行，暂停的是 CMS / Web 及其他写入者。使用 S3 API 复制对象，不在 MinIO 运行时把数据目录简单打包当成一致的备份。现有脚本的镜像清单覆盖基础应用；另行保存 MinIO 服务端 / 客户端的源码版本、镜像 ID 与 `.env`、初始化策略。恢复到空 MinIO 时先运行初始化任务重建账号和策略，再恢复媒体对象与数据库。

只使用包含异地 `COMPLETE` 标记且校验通过的快照恢复。还要独立加密备份 `.env`、`/etc/zhuduo`、证书配置、MinIO 管理凭据和必要的 GitLab 入口配置，避免恢复时丢失加密密钥或网关规则。GitLab 自己的数据备份是另外一套流程。

恢复到**全新隔离数据库和媒体目标**的完整流程见仓库 [生产部署与隔离恢复](../../deploy/README.md)。正式上线前应完成一次恢复演练。

数据库快照中已有图片记录保存的是绝对 URL。演练时仅更改 `MEDIA_PUBLIC_URL` 不会更新旧地址；需要在隔离环境映射原媒体域名到恢复入口并使用有效 TLS，或只在恢复库中审核、替换文件及 `formats` 的 URL 前缀。验证时阻断生产媒体访问，确认读取的确实是恢复对象，不更改生产 DNS 或数据。

### 14.4 回退

- DNS 配置异常：恢复本教程的目标记录，即 `@` A → `43.110.24.91`、`www` CNAME → `bjzdbuilding.com`，并核对旧 AAAA。Vercel 已解绑，不再将域名指回临时展示地址。
- 新增网站 Nginx 配置有问题：恢复网站配置备份，先 `nginx -t`，再平滑加载。保留原 GitLab 配置，不删除整套入口。
- 应用版本异常：只有在数据库与旧版本仍兼容、旧镜像仍保留时，才可将 `.env` 的 `RELEASE_TAG` 改回旧值，并使用 `zd-compose up -d --no-build postgres cms web` 运行原镜像，随后完整验收。
- 如果新 CMS 已经做了数据库迁移，单纯换旧镜像不等于安全回退；需要按备份恢复流程恢复匹配版本的数据，在隔离目标验证后再安排切换。

不要在生产执行 `down -v`，也不要通过删除数据库卷来解决登录或密码问题。

## 15. 如果实际使用的是独立系统 Nginx

本节仅用于第 2 步发现 80 端口属于 `/usr/sbin/nginx`，而不是 GitLab 自带 `/opt/gitlab/embedded/sbin/nginx` 的情况。

应用仍使用相同的 `zd-compose`、127.0.0.1:13000 与 127.0.0.1:11337。网站 HTTP / HTTPS 配置内容不变，做以下替换：

1. 不修改 `/etc/gitlab/gitlab.rb`，不运行 `gitlab-ctl reconfigure`。
2. 通过该系统 Nginx 已有的 `http` include 目录加载网站文件，例如在 Ubuntu `/etc/nginx/conf.d/` 中建立指向 `/etc/zhuduo/nginx/website.conf` 的链接。先查看已有配置，避免重复加载。
3. 把网站配置中的 `/var/log/gitlab/nginx/zhuduo_*.log` 改为 `/var/log/nginx/zhuduo_*.log`。
4. 所有网站配置检查改用 `nginx -t`，所有 reload 改用 `systemctl reload nginx`。
5. 证书 deploy hook 内的检查和 reload 同样替换成 `/usr/sbin/nginx -t` 与 `/usr/bin/systemctl reload nginx`。

保留已有 GitLab 的 server 块、上游代理与默认主机规则。如果无法判断哪个程序拥有 80 端口，先补充进程可执行文件路径和现有入口配置，不同时启动两个网关。

## 16. 常见问题

| 现象 | 优先检查与处理 |
| --- | --- |
| 提示 `address already in use`，80/443 被占用 | 确认用的是 `zd-compose`，且没有启用 `standalone-gateway` profile 或启动原项目 nginx。保留现有 GitLab Nginx。 |
| 域名仍打开旧站 | 查权威 DNS 与本地缓存，确认原 Vercel 的 A / CNAME 已按计划切换，检查旧 AAAA；不要把缓存传播误判为构建失败。 |
| 打开域名出现 GitLab 登录页 | Nginx 未加载对应网站 `server_name` 配置，或访问的主机名没有被包含；核对 custom include 并检查配置。 |
| 证书签发失败 | 检查四个域名的 A / AAAA、CAA、安全组 80、外部可达的 ACME 测试路径；媒体域名已包含在本次证书中。 |
| 网站 502 | 检查 `zd-compose ps`、本机 13000 / 11337 健康地址及 `/var/log/gitlab/nginx/zhuduo_error.log`。 |
| 后台 500 / unhealthy | 查看 CMS 日志；检查数据库、密钥、MinIO 参数和当前配置版本，不连续重复 restart 代替诊断。 |
| MinIO 容器 healthy，但宿主机 19000 连接被拒绝 | 对比声明的 `PortBindings` 与实际 `NetworkSettings.Ports`；若实际映射为 `null`，按第 8.3 节更新网络配置并仅重新创建 MinIO。 |
| 首次打开后台返回 403 | 检查第 11.3 节临时 IP 限制，填写的是当前电脑实际公网出口；管理员创建成功并验证登录后，按第 12.1 节解除临时限制。 |
| MinIO `AccessDenied` / 签名错误 | 查看 `minio-init` 日志，确认独立 CMS 凭据、`S3_ENDPOINT=http://minio:9000`、`S3_REGION=us-east-1`、`S3_FORCE_PATH_STYLE=true` 和服务器时钟。 |
| 上传成功但图片加载失败 | 检查包含 `/zhuduo-media` 的 `MEDIA_PUBLIC_URL`、媒体 A 记录、Nginx 路径与证书、MinIO 匿名 GetObject 策略和后台 CSP；前台不能依赖 VM 私网地址。 |
| 中文没有产品 / FAQ | 正式库没有对应语言的已发布内容；补齐 `zh-Hans` 内容或按第 13 节迁移，等待约 30 秒缓存。 |
| 询盘未成功 | 检查 Web / CMS 日志、两端服务密钥、数据库；可选验证码必须成对配置。成功弹窗后还要确认后台入库。 |
| 修改 `.env` 后没有生效 | 用 `zd-compose up -d --wait postgres cms web` 重新创建需要变更的容器；只有 `restart` 不会重新注入 `.env`。 |
| 更换数据库密码后无法连接 | 已有 PostgreSQL 的角色密码不会随 `.env` 自动改变；按数据库密码轮换步骤处理，不删除生产卷。 |

## 17. 最终访问地址与本教程验证范围

| 功能 | 正式地址 |
| --- | --- |
| 主站 | `https://bjzdbuilding.com` |
| 中文界面 | `https://bjzdbuilding.com/?lang=zh` |
| www | `https://www.bjzdbuilding.com`，跳转到主站 |
| 中文后台 | `https://cms.bjzdbuilding.com/admin` |
| 公开产品图片 | `https://media.bjzdbuilding.com/zhuduo-media/…` |
| 保留的 Git 仓库 | `http://43.110.24.91/zd/web.git` |

教程依据仓库实际 Compose、Dockerfile、代理头、内容语言和备份流程编写，入口按本次 ECS 的现有 GitLab 情况调整。实际镜像构建、云端 Nginx 版本、证书签发、MinIO 上传、真实内容迁移与询盘入库，需要在服务器按步骤完成验收；编写文档不表示这些云端操作已经执行。
