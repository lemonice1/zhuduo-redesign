# Public website

Next.js App Router renders the original bilingual homepage and the electrical/modular housing product catalogue under `/products/[division]/[category]`. The server reads published homepage data from Strapi `/api/homepage` and the complete catalogue from paginated `/api/products` reads; CMS reads are cached for 30 seconds. See [product centre implementation](../../docs/operations/product-centre.md) for category keys, compatibility and verification.

`POST /api/inquiries` validates and forwards the approved payload to Strapi with a server-only shared secret. It returns success only for a valid saved-record acknowledgement. Product selection and application context are included with the inquiry.

Start through the root VM Compose file. Host development uses Node.js 24 and root `npm run dev:web`; the VM dev server binds `0.0.0.0`. Configure `STRAPI_PUBLIC_URL` and `STRAPI_SERVER_TOKEN` on the server to enable inquiries. Neither is a browser credential.

The original CSS illustrations are concept placeholders. Replace the sample brand, contact address, and media with approved business content before launch.

For local review without CMS, set the server-only `SITE_PREVIEW_MODE=true`. The root renders the normal homepage with formal product URLs and inquiry demonstrations. Normal production still requires CMS configuration and saved inquiry acknowledgements. `/preview` remains a separate demonstration entry.

The approved redesign now runs on the formal homepage and section routes. The shared design review remains at `/preview/homepage?lang=en`; that route always simulates inquiries without making API submissions.

## 新版正式架构

主导航为 Electrical Equipment、Modular Buildings、Applications、Projects、Resources、About Us、Contact；点击 Logo 返回首页。语言为 `en`、`ar`、`fr`，阿拉伯语不改变页面布局方向。

- 电气产品：`/products/electrical`；Transformers、Switchgear、Substations 下有独立分类页和产品详情页。
- 房屋产品：`/products/modular-buildings`；七个主分类各有独立页面。
- 应用：`/applications`，以及能源、工业、住宅酒店、商业临建四个页面。
- 项目：`/projects`，仅保留 `featured-projects`，读取现有已核实并发布的案例；无案例时显示待补充提示。
- 资料：导航仅展示 `/resources/technical-documents`，房屋与电气设备文档分别在后台 Single Types 维护，发布后可直接下载。维护说明见 [文档下载页](../../docs/operations/technical-documents.md)。
- 公司与询盘：`/about`、`/contact`。正式询盘保留必填国家字段、验证组件及后台保存回执检查。

旧 `/products/modular-housing/...`、`/products/electrical/power-transformers/...` 等已知地址会永久跳转至对应新地址并保留语言。旧太阳能房屋分类继续可访问，但不增加主导航分类数量。分类与产品不匹配、未发布或不存在的产品返回 404。

正式路由先完成内容与地址校验再输出页面，确保真实 HTTP 308 / 404 状态；流式 Loading 占位只用于 `/preview` 路由，避免过早输出把重定向或错误状态变成 200。

## 后台维护

新增字段均为可选，不自动修改已有产品或翻译，也不写入后台公司数字、客户案例、证书和联系方式。编辑对应语言后需要发布，公开页面数据缓存约 30 秒。

首页介绍区右侧使用 `public/videos/zhuduo-company-introduction.mp4` 和同目录的封面图。默认显示封面和中央圆形播放按钮，不预载整个视频；点击后播放并显示原生控件，支持手机内嵌播放。

出口市场当前展示法国、沙特阿拉伯、英国三面国旗，使用 `public/flags` 中的本地 SVG（来源：FlagCDN），代替原来的市场数量。国旗在栏内向左循环滚动，鼠标移入或键盘聚焦时暂停；开启减少动态效果时静态显示。

年份和工厂面积进入视口时，从 1 递增到后台配置的最终数值，约 1.8 秒完成，每次打开页面只播放一次。面积保留千位分隔符和单位；开启减少动态效果或浏览器不支持视口观察时，直接显示最终数值。

右下角 Chatbox 替代原 WhatsApp 悬浮按钮。访客发送咨询后填写姓名、国家，以及邮箱或带国家代码的 WhatsApp（至少一项），再明确提交联系方式。正式提交沿用 `/api/inquiries`、反垃圾校验及后台保存回执；Inquiry 中保存咨询内容、联系方式、产品上下文和 `chatbox:语言:页面路径` 来源，跟进状态为 `new`。这是留言收集窗口，由销售后续联系客户。

`/preview` 与 `SITE_PREVIEW_MODE=true` 的本机预览只演示聊天流程，不写入后台；界面明确显示预览提示。正式启用需要同时更新 CMS 和 Web。超级管理员可直接查看新增 WhatsApp 字段；已有 Sales 角色的权限保持原样，如需查看该字段，由超级管理员在角色权限中增加 Inquiry → Read → whatsapp，并按需将其添加到列表列中。

| 内容类型 | 字段 / 操作 | 前台位置 |
| --- | --- | --- |
| Site Setting | companyIntro、companyAddress | 公司介绍、页脚地址 |
| Site Setting | foundedYear、factoryArea（平方米）、certificationCount | 公司数据；年份、面积未填时使用已确认的 2013、2000 m²，认证未填显示破折号 |
| Site Setting | factoryImage、heroHousingImage、heroElectricalImage | About Us 工厂照片、首页两侧 Banner |
| Site Setting | contactEmail、whatsappNumber（带国际区号） | 邮件及 WhatsApp 真实链接 |
| Site Setting | exhibitionName、exhibitionDetails | 展会信息；未填名称时显示待补充占位，发布后自动替换 |
| Product | featured、sortOrder | 首页每个业务最多四个产品；优先推荐项，沿用后台排序 |
| Product | categoryKey | 新分类支持 dry-type-transformers、special-transformers、mv-switchgear、lv-switchgear、compact-substations、prefabricated-substations；旧分类键继续兼容 |
| Product | brochure、image、gallery | 手册下载、产品图及图集 |
| Product | detail、customizableOptions、productFaqs | 中文分组编辑介绍、参数、配置和产品 FAQ，逐条填写无需 JSON；见 [产品编辑说明](../../docs/operations/product-editing.md) |
| Project Case | isVerified=true、title、location、productName、quantity、image / imageUrl；发布 | 首页及 Projects 页面最多三条完整案例；默认不展示未核实的演示案例 |
| Certificate | title、document；发布 | 首页证书；图片可预览，PDF 可打开；无有效文件时显示三个占位，发布后自动替换 |
| FAQ | question、answer、sortOrder；发布 | 资料中心 FAQ |

新建 Operations 角色会包含新增字段；已有角色的手动权限不会被覆盖。若已有运营账号看不到字段，由超级管理员在 Settings → Administration Panel → Roles → Operations 中授予相应字段的读取、创建和编辑权限，以及需要的语言权限。自动翻译启用时，需同时允许目标语言的新本地化字段。

## 验证

Applications 四个独立页面在后台 **Content Manager → Single Types** 中分别维护标题、简介、封面和 Markdown 正文，支持草稿和发布。编辑入口、语言和权限说明见 [Applications 页面编辑](../../docs/operations/application-pages.md)。

`npm run build:web`、`npm run build:cms` 分别验证生产构建。`npm run test:site-browser` 在生产前台与隔离的本机 CMS 测试服务上验证新架构、旧链接、资料、三语言布局和询盘，不连接真实后台。

浏览器测试使用 Playwright；可通过 `PLAYWRIGHT_PACKAGE_JSON` 指定已安装包的 package.json，通过 `CHROME_EXECUTABLE` 指定 Chrome 路径。截图写入忽略目录 `output/formal-site/`。不要让开发服务与生产构建同时写入同一个 `.next`。
