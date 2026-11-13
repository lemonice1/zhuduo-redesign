# 普通询盘表单接入小满 OKKI

使用账户提供的官方「询盘表单自动绑定」脚本，站点 ID 为 `528096-34388`。这是公开追踪标识，不是 CRM API 密钥。此次只更新 Web，不改变 CMS 数据结构或已有询盘。

## 运行范围

- 生产构建在 HTTPS 的 `www.bjzdbuilding.com` 和 `bjzdbuilding.com` 上异步加载一次官方脚本。Next 客户端切换页面后，新出现的普通表单也可被识别。
- 开发环境、本机/IP/其他域名、`SITE_PREVIEW_MODE=true` 和直接访问 `/preview` 不加载脚本。
- 普通表单保留网站后台保存流程与验证，后台依然是询盘的保存依据。小满 SDK 加载失败或被拦截时，不阻断网站后台保存。
- Chatbox 和预览表单增加 SDK 可识别的 `target-sdk-ignore` 控件，排除普通表单自动绑定。Chatbox 仍按原流程保存完整会话到网站后台。
- SDK 属于整个浏览器文档，已加载后不能通过移除 script 卸载其监听器。从正式页切到预览时应使用新标签或完整刷新；预览表单的忽略标记仍会阻止表单采集。

## 字段对应

| 表单字段 | 内容 | 小满建议对应字段 |
| --- | --- | --- |
| `name` | 姓名 | 姓名 |
| `email` | 邮箱 | 邮箱 |
| `country` | 国家/地区 | 国家/地区 |
| `quantity` | 数量（展示该字段时） | 数量或询盘内容 |
| `message` | 咨询内容 | 询盘内容 |
| `product` | 当前语言产品名称及标识 | 产品或自定义字段 |
| `inquirySource` | `site:页面路径`、`catalogue:页面路径` 或 `project:页面路径` | 来源或自定义字段 |
| `inquiryLanguage` | `en`、`fr`、`ar` | 语言或自定义字段 |

官方 SDK 会跳过 hidden 控件；附加上下文采用不占视觉空间、不进入键盘焦点的只读控件，名称固定。原业务字段 `productType`、`source` 保持原样。附加字段不会存入网站 Inquiry，也不向浏览器暴露 `STRAPI_SERVER_TOKEN` 或 Turnstile 私钥。

## 上线后账户核对

发布包含这些修改的 Web 版本后，在小满确认该站点检测到脚本，并检查「MKT 询盘 → 询盘管理」。根据实际采集结果设置字段匹配、跟进人和通知接收人。此次代码不操作小满账户，也不启用小满在线聊天；如果账户自身启用了 `live_chat`，官方脚本可能加载它，需在小满关闭以保留当前 Chatbox 体验。

经授权提交一条带唯一内容的真实询盘，分别核对网站后台与小满的邮箱、产品、内容和来源。统计面板可能延迟到次日；询盘应直接在询盘管理核对。两个域名共用同一追踪 ID；如其中一个域名未被账户接受，需要在小满确认域名绑定范围。

这属于浏览器自动采集：SDK 可能在点击提交、网站后台返回保存结果之前上报；因此后台拒绝或网络失败的提交也可能被小满采集。它不提供后台保存成功后才投递、可靠重试或两个系统严格一致的保证。浏览器拦截脚本也可能导致小满漏收，不能代替查看网站后台。需要这些保证时，再确认小满服务端接口权限并单独实现。

## 本机验证

`npm run build:web` 后运行 `node tests/smoke/okki-browser.mjs`，使用 Playwright（可通过 `PLAYWRIGHT_PACKAGE_JSON` 指定安装位置）和 `CHROME_EXECUTABLE` 指定的 Chrome。可用 `OKKI_SDK_PATH` 指向已下载的官方 JS；否则仅下载公开脚本文件。

测试通过虚拟正式域名访问本机 Next，CMS 为本机临时服务。浏览器所有请求都经过拦截，小满配置、统计、询盘和 Cloudflare 验证均由本机替身响应，其他外部请求一律阻断，不向真实小满账户写测试询盘。

检查英文/法文/阿拉伯文表单、Next 页面切换、两个域名、产品详情来源、手机项目详情来源、Chatbox 排除、直接预览和浏览器返回预览、本机不加载以及 SDK 失败时仍可保存。输出 `output/okki/report.json`（包括 SDK SHA-256）及页面截图。另运行 `node --test apps/web/tests/inquiry-route.test.mjs apps/web/tests/inquiry-directions.test.mjs` 检查保存接口与产品选择契约。

官方说明：[网站询盘自动绑定](https://xiaomanhelp.yuque.com/qrqrfu/zx42k3/afyoxmzb4db0aqb0)、[自定义表单追踪](https://xiaomanhelp.yuque.com/qrqrfu/ig3ops/zx6gam6lzzqrytim)。
