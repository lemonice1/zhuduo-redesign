# 产品中心实施说明

> 分类管理已升级：业务人员在 Collection Types → **产品分类** 维护名称、排序、菜单显示和分类页面；产品选择已发布分类。正式站支持 English / Français / العربية，产品使用独立详情页。以下旧版固定分类表与弹窗描述仅供历史迁移参考，当前操作见[产品分类操作说明](product-categories.md)和[产品编辑说明](product-editing.md)。

正式首页继续使用原有首页组件，产品中心沿用原有下拉菜单样式。下拉菜单包含电气设备、模块化房屋两个大类，桌面显示级联子菜单，手机支持展开。

| 页面 | 地址 |
| --- | --- |
| 原首页 | `/?lang=zh` |
| 电气设备 | `/products/electrical?lang=zh` |
| 模块化房屋 | `/products/modular-housing?lang=zh` |
| 主变压器 | `/products/electrical/power-transformers?lang=zh` |
| 太空舱 | `/products/modular-housing/space-capsules?lang=zh` |

`lang=en` 使用英文；生产环境未指定语言时沿用英文默认值。原 `/preview` 地址仍可访问，预览和正式页面复用相同组件，预览询价不提交网络请求。

## 后台发布产品

Strapi 的 Product 新增非本地化字段 `categoryKey`，从以下选项选择。该字段在中英文之间共享，`category` 继续保存当前语言的分类显示文案。

| 大类 | 分类 | categoryKey |
| --- | --- | --- |
| 电气设备 | 配电变压器 | `distribution-transformers` |
| 电气设备 | 主变压器 | `power-transformers` |
| 电气设备 | 箱式变电站 | `substations` |
| 电气设备 | 中压配电设备 | `mv-distribution` |
| 电气设备 | 低压配电与控制 | `lv-distribution` |
| 模块化房屋 | 扩展式集装箱房 | `expandable-homes` |
| 模块化房屋 | 折叠式集装箱房 | `folding-homes` |
| 模块化房屋 | 钢结构建筑 | `steel-structures` |
| 模块化房屋 | 平板集装箱房 | `flat-pack-homes` |
| 模块化房屋 | 可拆卸集装箱房 | `detachable-homes` |
| 模块化房屋 | 太阳能集装箱房 | `solar-homes` |
| 模块化房屋 | 太空舱 | `space-capsules` |
| 模块化房屋 | 苹果舱 | `apple-cabins` |

填写产品标题、简介、详情、配置、主图 `image`、图库 `gallery` 和产品册 `brochure`，选择分类后发布所需语言。首页读取 `/api/homepage` 的 FAQ 和设置，并通过只读 `/api/products` 分页读取完整的已发布产品；分类页使用同一来源，每页读取 100 条，页面每页展示 24 款。未发布的语言不会用另一种语言或本地样例替代。读取保持 30 秒缓存。

旧产品允许缺少 `categoryKey`：已有五款产品按准确 SKU 归类；其他旧产品只有分类文案与上述中英文名称完全匹配时才归类。未识别的旧产品继续出现在原首页，可在后台补选分类后进入分类页。不会自动修改或重新发布已有记录。开发环境新导入的公司产品会同时写入分类键。

没有已发布产品的分类显示空状态和咨询入口，不显示参考图商品卡。公司资料整理、导入和日常换图见[公司产品册导入](company-product-import.md)。

## 页面交互和询价

同一大类内切换分类时，原位更新列表、地址、标题和选中状态，保留滚动位置；浏览器前进、后退、直接刷新均可恢复分类。不同分类列表高度变化不会把页面强制推到顶部或底部。

点击图片或信息按钮打开详情弹窗，支持关闭按钮、Esc 和遮罩关闭，恢复焦点及浏览位置。详情弹窗中的咨询按钮会切换到询价窗口，并带入产品 SKU 或分类键。

正式询价复用原有 `InquiryForm`、Next.js `/api/inquiries` 和 Strapi 保存接口，保留验证码、验证、错误提示和回执检查。`productType` 保存产品 SKU 或分类键，`source` 为 `catalogue:/products/...`，首页继续使用原来源格式。只有收到已保存回执后才显示成功，接口失败会保留填写内容。

询盘的“产品方向”使用统一的自定义下拉框，按“电气设备 / 模块化房屋”切换，分类与具体型号分段显示，可搜索、清除选择并通过键盘操作。列表限制高度并独立滚动，弹层会避开视口边缘。后台 Product 控制已发布型号、名称及排序；`categoryKey` 决定型号所属大类。未分类的旧产品仍可在“其他产品”中选择。固定分类及大类名称维护在 `packages/contracts/product-taxonomy.json`，下拉框视觉样式维护在前端代码；本次调整不需要新增后台字段或迁移数据。

## 本地查看与发布

仅查看页面且本机未配置 CMS 时，可在项目根目录执行：

```powershell
$env:SITE_PREVIEW_MODE = 'true'
npm.cmd --workspace @modular/web run dev -- --port 3100
```

此时 `http://localhost:3100/` 直接渲染正式首页，分类链接使用正式 `/products/...` 地址，询价保持本地演示模式。`SITE_PREVIEW_MODE` 仅用于本地查看，正式环境不设置此变量；生产环境缺少 CMS 或 CMS 读取失败时会正常报错。

正式环境继续使用现有 `STRAPI_PUBLIC_URL`、`STRAPI_SERVER_TOKEN` 以及可选的 Turnstile 配置。更新时同时构建 CMS 和 Web，使后台加载新增字段。现有 VM/ECS 部署步骤见相应运维文档。本次代码实施没有连接远端后台修改数据或发布线上服务。

验证命令：

```powershell
node --test apps/web/tests/*.test.mjs tests/contracts/*.test.mjs
node --test apps/cms/tests/*.test.mjs
npm.cmd run build:web
npm.cmd run build:cms
npm.cmd run test:catalogue-browser
```

浏览器验证使用独立 HTTP CMS 测试替身，检查完整分类列表、中英文隔离、原首页、正式导航、详情弹窗及询价失败/成功回执，不写入实际数据库。可通过 `PLAYWRIGHT_PACKAGE_JSON` 指定 Playwright 运行环境，通过 `BROWSER_EXECUTABLE_PATH` 指定本机 Chrome。
