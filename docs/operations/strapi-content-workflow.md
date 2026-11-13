# Strapi 内容操作

1. 访问 `http://VM_IP:1337/admin`，首次创建管理员，后续登录。
2. 在 Content Manager 的 **Site Setting** 编辑网站名称、联系邮箱和页脚文案，保存并发布。
3. 打开 **Product** 编辑 `title`、`slug`、`summary`、`category`、`detail`。`customizableOptions` 为字符串数组，例如 `["Layout", "Insulation", "Finish"]`，`sortOrder` 越小越靠前。
4. 在 Media Library 上传公开产品图片；在产品的 `image` 字段选择主图，在 `gallery` 选择附图，`brochure` 选择产品册 PDF。`image` 优先于备用的 `imageUrl`；图片和产品册在不同语言之间共享。
5. 编辑 **FAQ** 的问题、答案与排序，保存并发布。
6. 等待约 30 秒再刷新首页。草稿不会出现在公开 `/api/homepage` 中。

后台公开内容模型支持 Strapi 5 内置本地化，前台英文界面读取 `en`，中文界面（`?lang=zh`）读取 `zh-Hans`；中文无已发布记录时展示空状态，不自动替换成英文或示例内容。在 Settings → Internationalization 中添加语言，再在 Content Manager 的语言选择器中编辑并单独发布译文。可选的[自动翻译与同步发布](auto-translation.md)配置成功后，点击发布可生成并发布其他语言。Product 的标题、摘要、分类、详情与选项文字，Project Case 的标题、地点、应用、摘要与详情，Article 的标题、摘要与正文，Certificate 的标题、说明与颁发机构，以及 FAQ 和网站名称/页脚文字均可翻译。Inquiry 不本地化、没有草稿发布流程，内部备注保持私有。

VM 开发环境 `SEED_DEMO_CONTENT=true` 时初始化 `en` 与 `zh-Hans` 内容语言，并为四条原始英文示例 FAQ 补齐已发布的中文版本。更新代码后重建或重启 CMS 即执行，前台仍只读取 CMS 的已发布记录。只补齐内容完全符合原始示例且没有任何中文版本的 FAQ；已修改的英文内容、中文草稿或中文已发布版本均保留，不在重启时覆盖或重新发布。生产环境和关闭演示初始化时不执行此补齐。

后台界面已启用 `zh-Hans`（中文简体），首次打开且没有浏览器语言偏好时默认使用中文。已有管理员登录后，点击左下角头像 → Profile / 个人资料，在 Experience / 使用体验中的 Interface language / 界面语言选择“中文（简体）”，再点击 Save / 保存。Strapi 优先使用账户保存的语言偏好；每个管理员可以独立选择语言。此设置控制后台按钮和菜单文字，内容译文需单独发布或启用上述自动翻译流程。

VM 开发环境拉取代码后重启 `cms`，待健康检查通过再用 Ctrl + F5 刷新 `/admin`。生产环境需要重新构建并部署 CMS 镜像，让后台资源包含中文配置。

无需给 Public 角色开放写权限。公开内容接口仅注册 GET，并且服务器强制读取已发布版本：客户端提交 `status=draft` 或 `publicationState=preview` 也无法读取草稿。可选 `locale=en`、`locale=zh-Hans` 用于读取已发布译文，不传则读取后台默认语言。`locale=*`、`locale=all`、数组/对象及不合法代码会返回 400；没有已发布内容的语言返回空列表或 null。

| 公开接口 | 使用方法 |
| --- | --- |
| `/api/homepage` | 首页聚合，保持 `products`、FAQ 二维数组 `faqs` 和 `settings`；支持 `?locale=en`。 |
| `/api/products`、`/api/project-cases`、`/api/articles`、`/api/certificates`、`/api/faqs` | 返回 `{ data, meta: { pagination } }`。例如 `?locale=en&pagination[page]=1&pagination[pageSize]=12`；默认每页 25、最多 100，按 `sortOrder` 与 `documentId` 排序。 |
| 上述列表路径加 `/:documentId` | 读取详情，使用列表返回的 Strapi 5 `documentId`；草稿或不存在的记录返回 404。 |
| `/api/site-setting` | 单一网站设置，返回 `{ data, meta }`；无已发布设置时 `data` 为 null。 |

公开接口固定选择需要的文本与媒体字段，不接受客户端扩大 `fields`、`populate`、筛选或排序范围。不会输出后台编辑者身份、存储提供商元数据。除已有服务密钥保护的 `POST /api/inquiries/submit` 外，没有询盘公开查询、更新或删除路由。

初始化内容只在开发模式启用。公司产品目录现包含 113 款双语产品（17 款模块化房屋、96 款电气设备），太空舱仅保留 D7。产品资料出处、照片清理、正式环境导入与后台换图见[公司产品册导入](company-product-import.md)。正式环境需要明确执行导入命令，重启不会自动创建或发布这些产品。FAQ、示例品牌和邮箱仍需在上线前核对；应用场景效果图不作为已交付项目业绩。

`Project Case` 可编辑 `title`、`location`、`application`、`summary`、`detail`、`slug`、`image`、`gallery` 与排序；保留备用 `imageUrl`。为兼容旧记录，slug 暂不强制填写，准备未来页面时应补齐唯一 slug。`Article` 需要标题和唯一 slug，可填写摘要、正文、封面图片与排序。`Certificate` 需要标题和唯一 slug，可填写说明、颁发机构、证书图片/PDF 与排序。没有真实材料时保持列表为空，不编造客户、项目、证书、规模、交期或价格。这三个模型没有演示 seed；当前前台尚未接入相应独立页面。

## About Us 证书维护

前台 About Us（`/contact?lang=en`）询盘上方的 Certifications 使用 **Collection Types → Certificate** 的已发布内容，不在 Site Setting 中维护。

1. 新增或编辑 Certificate：填写 `title`（前台名称）、`slug`（唯一英文网址标识），在 `document` 上传或选择证书图片／PDF。说明和颁发机构可选。
2. `sortOrder` 数字越小越靠前；相同数值按文档标识稳定排序。页面读取前 12 条记录，仅展示其中已绑定上传文件的证书。
3. 保存仅更新草稿，点击发布后前台通常约 30 秒同步。图片统一展示框且完整显示，点击打开原图；PDF 等文件显示文档图标，点击打开文件。
4. 英文、法语、阿拉伯语按各自已发布版本展示。自动翻译关闭时，需要在内容语言选择器中补齐并分别发布；配置自动翻译后沿用现有同步发布流程。
5. 取消发布或删除后，前台同步移除；当前语言没有已发布证书时整块隐藏，不回退到固定图片。Media Library 上传本身不会使文件显示到页面，必须绑定到 Certificate 的 `document` 并发布。

## 公司产品文档更新

在 VM 开发环境下，`NODE_ENV=development` 且 `SEED_DEMO_CONTENT=true` 时，重启 CMS 会导入公司目录中尚不存在的产品，并发布英文和简体中文版本。两种语言使用相同的文档 ID，图片和排序共享；不需要翻译接口。只有仍完全匹配原始示例、且没有上传图片的旧英文产品会取消发布，原始草稿保留。已被人工编辑的旧产品和已有公司产品草稿、译文均不覆盖，也不会因重启被重新发布。导入与旧示例下架使用同一事务，出错时回滚。公司太空舱系列目前仅保留 D7；已导入的 D5、D6、D9、D2、D8 将在开发初始化时取消中英文发布，并保留草稿。前台会过滤这些已移除的型号，避免 CMS 更新期间显示旧产品；首页与应用场景的 D9 配图同时替换为 D7 内饰。

产品名称、尺寸、重量及配置位于 `packages/contracts/company-products.json`，每款产品记录文档页码。图片位于 `apps/web/public/products`，出处与裁切记录在 `sources.json`。`imageUrl` 的 `/products/…webp` 地址由前台提供，后台仍可在 `image` 字段上传新的图片，上传图片优先显示。文档中尺寸以参数表为准；页面未添加未经确认的价格、交期、认证或已交付案例。

在 `/opt/www/web` 逐条执行：

```bash
git pull --ff-only origin codex/complete-development-plan
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env restart cms web
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env ps
```

CMS 健康后，分别检查首页英文和中文产品系列。如关闭了开发初始化，需在后台手动创建并发布产品；生产模式不会自动导入或改变发布状态。
