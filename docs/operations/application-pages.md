# Applications 页面编辑

四个页面分别使用一个 Strapi Single Type，原地址保持不变：

| Single Types 中的名称 | 前台地址 |
| --- | --- |
| Energy & Utilities | `/applications/energy-utilities` |
| Industrial Projects | `/applications/industrial-projects` |
| Residential & Hospitality | `/applications/residential-hospitality` |
| Commercial & Temporary Buildings | `/applications/commercial-temporary-buildings` |

进入后台 **Content Manager → Single Types**，选择对应页面和语言（English / French / Arabic）：

- `title`：页面标题，也用于浏览器标题。
- `summary`：可选简介，显示于页头，也用于搜索摘要。
- `coverImage`：可选封面，三个语言共用；正文图片可通过 Markdown 编辑器插入。
- `body`：必填 Markdown 正文，可使用标题、段落、加粗、列表、链接、图片、引用和代码块。

例如：

```markdown
## Project requirements

Describe this application here.

### Our solution

- Custom designs
- Global delivery

![Project image](/uploads/example.jpg)
```

保存草稿不会改变前台，点击 **Publish** 后生效；通常在 30 秒缓存刷新后可见。已启用的自动翻译发布流程同样适用于这些页面；未启用时，三个语言分别编辑和发布。正文按语言显示，阿拉伯语不会翻转全站布局。

某页面或语言尚未发布、被取消发布，或 CMS 暂未升级到新增模型时，前台保留原有应用介绍。发布后的正文独立显示，不再自动拼接产品推荐。现有产品、案例、Site Setting 等数据不迁移、不覆盖。

新增模型后需重启 CMS，使四个编辑入口出现在 Single Types。Super Admin 自动拥有权限；新建 Operations 角色默认可编辑发布。已有角色的自定义权限保持不变，如需使用已有 Operations/其他编辑账号，由 Super Admin 在 **Settings → Administration Panel → Roles** 中为这四项勾选所需字段、语言及读写/发布权限。

本次改动仅新增四张内容表及读取接口。代码回退时原有页面和数据仍然可用；不要为回退删除新表。正式发布依照现有 ECS 部署流程进行。

验证：`node --test apps/web/tests/application-*.test.mjs apps/cms/tests/public-content.test.mjs apps/cms/tests/admin-roles.test.mjs apps/cms/tests/auto-translation.test.mjs`。生产前台构建完成后，可用 `node tests/smoke/application-pages-browser.mjs` 检查实际页面；Playwright/Chrome 路径配置与现有 `site-browser.mjs` 相同，`APPLICATION_HTTP_ONLY=true` 可仅检查生产 HTTP 渲染。测试使用隔离内容服务，不修改后台已有内容。
