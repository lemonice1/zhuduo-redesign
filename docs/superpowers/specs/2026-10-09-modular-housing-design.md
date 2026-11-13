# 集装箱房外贸独立站：设计草案

日期：2026-10-09

本文件保留已确认的技术选型与最初首页设计草案。2026-10-09 用户确定使用 Strapi；2026-10-10 已实现首轮英文首页、Strapi 内容/询盘后台与 VM 开发编排，具体交付与验证范围见项目 README 和 design-qa.md。

## 已确认的需求

- 主营集装箱房与模块化建筑。
- CMS 已确认使用 Strapi；Next.js 负责前台，Strapi 独立负责后台内容与询盘管理。
- 参考 https://www.tsbaoding.com/ 的业务内容与采购路径，采用新的视觉、布局与原创文案。
- 当前工作区为空，首轮交付范围建议为可运行的英文响应式首页原型。
- 用户提出使用 MinIO 存储图片等文件、通过云服务器部署；技术上可采用 S3 兼容接入，自托管作为部署方向。MinIO 现有实例情况与新部署发行版尚未确定。
- 面向海外经销商、工程采购商、营地与住宿项目采购商。
- 页面核心任务：理解产品类型，了解定制与交付过程，提交清晰的项目需求。

## 三种设计方向

| 方向 | 页面重点 | 视觉方式 | 适合的业务 |
| --- | --- | --- | --- |
| 现代建筑品牌（推荐） | 产品、空间用途与项目询盘 | 白色底、石板蓝、少量铜色，大幅建筑图片和宽松排版 | 兼顾经销商与项目采购商 |
| 工厂工程供应商 | 工厂、结构和生产流程 | 深蓝与白色，紧凑参数表和生产图片 | 工程批量采购 |
| 营地与住宅方案 | 居住体验、场景与定制 | 自然色、生活场景和空间布局 | 民宿、营地和私人住宅项目 |

推荐首个方向：既呈现建筑产品的空间感，也能清晰表达供应商的服务能力。

## 推荐方案的视觉规则

- 主背景：白色 #FFFFFF。
- 次级背景：冷灰 #F2F5F7。
- 品牌主色：石板蓝 #193B50。
- 强调色：铜色 #BC7148，用于主要询盘按钮与少量重点。
- 正文：墨蓝 #162832；辅助文字：灰蓝 #627784。
- 标题采用有建筑感的窄体无衬线字，正文采用清晰的常规无衬线字；上线时字体文件放在项目内。
- 桌面内容区约 1240px，主要内容保留较大留白；手机端采用单列布局和简化导航。
- 首屏采用左侧品牌主张与按钮、右侧大幅模块化住宅图片的非对称构图。
- 记忆点是产品选型区域：按房型切换展示图片、用途和可定制选项，帮助采购商快速找到产品。
- 动效仅用于菜单、房型切换与少量内容出现，尊重减少动画设置。

## 首页结构与文案方向

### 导航与首屏

导航：Products / Applications / Manufacturing / FAQs / Request a quote。

首屏标题：Modular spaces. Built around your project.

说明：Explore expandable homes, flat-pack buildings and custom modular spaces for housing, hospitality and worksites.

主按钮：Request a quote。次按钮：Explore our products。

品牌名称未提供，原型暂用 MODULE HOUSE 文本标识；它是演示名称，可统一替换。

### 产品选型

三类首轮展示产品：Expandable homes、Flat-pack buildings、Capsule cabins。

每类展示产品图片、主要用途、可定制选项以及询盘按钮。详细信息通过抽屉展示，在首页内完成浏览。

尺寸、面积、安装时间、价格和材料等级仅在有真实资料时展示，不沿用参考企业的参数。

### 应用场景

展示住宅与附属居所、度假营地、办公与工地住宿。选择场景后可将场景名称带入询盘表单。

首轮不把概念场景写成已经交付的客户案例。提供真实项目后，加入国家、需求、配置及交付照片。

### 定制与交付

用四个真实业务阶段解释合作：Share your requirements → Confirm your configuration → Production and inspection → Shipping coordination。

呈现布局、饰面、保温和设施等可讨论内容，具体供货能力以企业资料为准。

### 制造能力

以结构材料、配置确认和交付前检查为信息框架。工厂规模、年产量、成立年份与认证列表需企业资料支持，不编造数字或证书。

### 常见问题

FAQ 折叠面板覆盖如何选型、是否能定制、报价需要哪些资料、运输安排和目的地要求。

回答强调报价与配置依项目确认，不承诺未经验证的交期、安装时间或合规范围。

### 询盘

字段：姓名、工作邮箱、目的地国家、产品类型、预计数量、项目需求。

从产品或场景入口进入时预选对应内容。

页面原型先完成必填与邮箱校验。后台接入后，询盘通过 Next.js 服务端接口校验并写入 Strapi 的 inquiry 内容类型，由 Strapi 保存至 PostgreSQL。询盘仅供授权后台人员查看，不开放匿名查询。未接通真实保存服务时不展示“询盘已提交”。

询盘记录包含姓名、邮箱、国家、产品类型、预计数量、项目需求、提交时间，以及内部跟进阶段和销售备注。前台不能修改跟进阶段或销售备注。邮件通知与保存分开处理，邮件失败保留已保存的询盘。提供真实销售邮箱和 WhatsApp 号码后，接入实际通知及联系渠道。

## 交互与实现范围

- 首轮只实现一个完整首页；产品详情通过抽屉呈现，导航滚动到对应区域。
- 房型切换、产品详情、应用场景选择、FAQ、手机菜单与询盘校验均可操作。
- 首页使用 Next.js App Router + TypeScript + Tailwind CSS；后台使用用户已确认的 Strapi 5 + TypeScript，前后台作为两个独立项目维护。
- 图片优先采用用户的真实产品素材；没有素材时使用标明用途的演示图片，避免把其他企业的图片当作自身产品或工厂。
- 不复制参考站的商标、文案、证书、联系方式或客户案例。
- 首页原型与后台基础分阶段实现；后台基础另有独立实施计划。产品详情、案例与文章独立页面以及更多语言，在首页和后台基础接通后扩展。

## 已确认的技术方向

用户已确认 Strapi 选型与云服务器部署方向。以下明确前后台职责，页面视觉仍采用上文待确认的设计草案。

| 层次 | 推荐选择 | 用途 |
| --- | --- | --- |
| 页面与接口 | Next.js App Router + TypeScript | 预生成或服务端渲染页面、独立产品 URL、询盘接口 |
| 样式 | Tailwind CSS + 定制组件 | 统一响应式规则，按本方案实现品牌视觉 |
| 内容管理 | Strapi 5 + TypeScript，独立 Node.js 服务 | 运营编辑产品、案例、文章、认证、媒体与询盘 |
| 数据库 | PostgreSQL，由 Strapi 的数据库连接与模型管理 | 保存内容、后台用户、媒体元数据与询盘记录 |
| 图片与资料 | 自托管 S3 兼容对象存储，按用户偏好支持接入 MinIO | 保存产品图片、项目照片、目录 PDF；发行版需结合维护状态确定 |
| 多语言 | next-intl + Strapi Internationalization | Next.js 管理语言路由与界面翻译；Strapi 管理各语言产品内容 |
| 联系渠道 | 询盘接口 + 邮件服务 + WhatsApp 链接 | 询盘先保存，通知发送失败可重试，避免丢失线索 |
| 托管 | Linux 云服务器 + Docker Compose + Nginx，可添加 CDN | 结合目标市场选择部署区域；应用、数据库与文件存储通过私有网络通信 |

正式站的产品、分类、案例与文章有独立 URL；配置 title、description、canonical、hreflang、sitemap 和适当的结构化数据。框架提供实现能力，搜索排名仍取决于内容、页面体验与其他因素。

询盘服务采用服务端字段校验、限流及防垃圾验证。后台仅授权人员可读客户信息。公开页面使用缓存，后台与询盘接口不缓存。通过缓存刷新使内容更新反映到前台。

项目分为 `apps/web`（Next.js）与 `apps/cms`（Strapi），二者独立构建和部署。一个 PostgreSQL 数据库仅由 Strapi 管理，Next.js 通过服务端访问 Strapi Content API；内容读取与询盘写入使用独立的最小权限服务端令牌。选用 Strapi 5 的稳定补丁版本并锁定依赖，配套上传提供器使用匹配版本。

首轮后台模型：product、project-case、article、certificate、faq、site-setting，以及内部 inquiry。网站内容启用草稿与发布，按需要启用内容多语言；inquiry 不启用草稿发布和多语言。后台分别配置运营与销售的访问权限。

### 云服务器与自托管文件存储

- 云服务器通过 Docker Compose 管理 Nginx、Next.js、Strapi、PostgreSQL 及文件存储服务；若已有 MinIO 实例，直接连接该服务。
- Nginx 作为 HTTPS 入口，分别转发站点与公开图片请求。网站入口如 `www.example.com`，公开媒体入口如 `media.example.com`；域名仅为示例。
- 图片、视频、PDF 等二进制文件存入对象存储；产品文案、参数、案例、询盘及媒体元数据存入 PostgreSQL。
- Strapi 使用 `@strapi/provider-upload-aws-s3`，在 `s3Options` 中配置自定义 `endpoint`、凭据、bucket 与适当的 `forcePathStyle`，通过标准 S3 API 接入 MinIO；正式实现时验证上传、缩略图、读取和删除流程。
- 网站媒体仅开放指定 bucket 或前缀的匿名读取，写入通过授权后台执行。客户资料使用私有存储与受控访问，不套用公开媒体策略。
- 数据库和存储管理界面通过私有网络或受限管理入口访问。存储凭据仅在服务端使用。
- PostgreSQL、对象文件及必要的应用缓存持久化，数据库与文件定期备份至服务器之外；单服务器方案不具备整站高可用性。
- 图片采用适当尺寸与压缩，可在公开媒体入口接入 CDN；管理后台和询盘接口不进入公开缓存。

2026-10-09 查阅官方资料发现：`minio/minio` 仓库于 2026-04-25 归档，README 明确声明不再维护。S3 技术兼容不受该状态改变，但新生产部署的维护来源需要重新确定；不将历史 `minio:latest` 镜像作为默认选型。若用户已有实例，先确认版本与维护方式；若从零部署，确定有维护来源的 S3 兼容发行版后再生成部署配置。

选型已确定为 Next.js + Strapi。前台呈现产品与询盘表单，独立后台维护内容、媒体及询盘记录，后续可接入销售 CRM。

官方能力依据：

- Next.js 服务端与客户端组件：https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js Metadata：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Strapi 安装：https://docs.strapi.io/cms/installation
- Strapi 数据库：https://docs.strapi.io/cms/configurations/database
- Strapi 内容多语言：https://docs.strapi.io/cms/features/internationalization
- Strapi 媒体提供器：https://docs.strapi.io/cms/configurations/media-library-providers
- Strapi S3 提供器：https://github.com/strapi/strapi/blob/develop/packages/providers/upload-aws-s3/README.md
- next-intl 路由：https://next-intl.dev/docs/routing/setup
- Next.js 自托管：https://nextjs.org/docs/app/guides/self-hosting
- MinIO 仓库与当前维护状态：https://github.com/minio/minio

## 验收标准

- 桌面与手机布局完整，没有横向溢出。
- 核心导航、选型和询盘流程工作正常，表单失败状态有明确提示。
- 弹层支持键盘与 Escape，关闭后焦点返回触发控件。
- 表单有可见标签；按钮和链接有清晰的键盘焦点。
- 不展示无法证实的业绩、认证或已发送成功状态。
- 构建检查通过；浏览器条件可用时验证实际页面与核心交互。

## 当前预览限制

参考站的页面内容已读取，但本会话浏览器连接两次失败，内置图像生成工具也未提供，因此尚未完成参考截图和图像版方案。本次提交文字版设计草案；是否直接按此方案实现由用户确认。
