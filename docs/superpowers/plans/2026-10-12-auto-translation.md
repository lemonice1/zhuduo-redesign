# Auto Translation Implementation Plan

> **For agentic workers:** Use `executing-plans` to implement this plan inline. Steps use checkbox syntax for tracking.

**Goal:** 管理员只填写一种语言，点击发布后自动翻译并发布所有已配置目标语言。

**Architecture:** 在原生 Document Service 的 publish 中间件中校验管理员各语言权限，调用可配置的 Chat Completions 服务，事务写入与发布。同一文档目标发布通过 AsyncLocalStorage 防止递归；默认关闭，接口未配置时不影响现有启动。

**Tech Stack:** Strapi 5.57.0、TypeScript、Node.js 24、PostgreSQL、Node test runner、原生 fetch。

**Spec:** `docs/superpowers/specs/2026-10-12-auto-translation-design.md`

## Global Constraints

- 不新增依赖或公开写路由；保留原有 Operations / Sales 权限边界。
- 六种公开内容参与翻译；询盘与管理员数据不发送到外部。
- 默认关闭；接口 URL、模型、密钥仅在 CMS 环境。
- 任何失败不发布部分语言；目标人工译文会在成功同步时覆盖。
- 使用同一 documentId，不发布其他文档或未选择的历史草稿。

### Task 1: 翻译协议

**Files:** Create `apps/cms/src/lib/translation-client.ts`, `apps/cms/tests/auto-translation.test.mjs`.

**Interfaces:** `TranslationConfig {enabled:boolean; apiUrl:string; apiKey:string; model:string; timeoutMs:number}`; `translateFields(config, sourceLocale, targetLocale, fields): Promise<Record<string, unknown>>`.

- [x] 写真实本地 HTTP 服务测试：返回的译文按已知源路径还原，JSON 键/数字保持；拒绝缺项、空白译文、截断、接口错误与超时，错误不包含密钥。
  ```js
  assert.deepEqual(await translateFields(config, 'en', 'zh-Hans', {title:'Folding home', options:['Layout', 3]}), {title:'折叠房屋', options:['布局', 3]});
  ```
- [x] 执行 `node --test apps/cms/tests/auto-translation.test.mjs` 确認缺少实现时失败。
- [x] 实现按源树提取字符串和重建；只接受与源文本数相等的 JSON 字符串数组，调用 `fetch` 使用 Bearer 密钥、JSON 输出和 AbortSignal 限时。
- [x] 执行同一测试，确认协议与错误场景通过。

### Task 2: 后台发布集成

**Files:** Create `apps/cms/src/lib/auto-translation.ts`, `apps/cms/config/auto-translate.js`; modify `apps/cms/src/index.ts`; expand `apps/cms/tests/auto-translation.test.mjs` and run existing `apps/cms/tests/admin-roles.test.mjs`.

**Interfaces:** `registerAutoTranslation(strapi): void`; uses `translateFields` above and native `permission-checker.create({userAbility, model})`.

- [x] 在真实 Strapi middleware manager 下测试 `en` 发布生成 `zh-Hans`，反向发布同样可用、缺失 locale 创建、已有译文更新、只修改 localized 字段、关闭时原行为、无管理员上下文跳过、目标调用不递归。
  ```js
  await strapi.documents('api::product.product').publish({documentId:'same-document', locale:'en'});
  assert.equal(published['zh-Hans'].title, '折叠房屋');
  ```
- [x] 用真实 Strapi permission checker / ability 添加目标 locale 和字段拒绝测试；用事务夹具检查翻译失败及第二个语言发布失败回滚全部变更。
- [x] 运行新增测试观察失败；实现白名单、草稿读取、权限预检、所有翻译、目标修改检测、事务更新与发布、异步递归保护。
- [x] 配置 env factory 默认 disabled；在应用 register 时注册中间件，缺失配置于发布时显示可操作错误。
- [x] 运行新增与现有 CMS 测试，确认权限边界与 lifecycle 兼容。

### Task 3: VM 配置与交付

**Files:** Modify `.env.example`, `.env.dev.example`, `.env.vm-dev.example`, `docker-compose.yml`, `docker-compose.vm-dev.yml`, `tests/deployment/compose-config.test.mjs`, `docs/operations/strapi-content-workflow.md`; create `docs/operations/auto-translation.md`.

**Interfaces:** `AUTO_TRANSLATE_ENABLED=false`, `AUTO_TRANSLATE_API_URL=`, `AUTO_TRANSLATE_API_KEY=`, `AUTO_TRANSLATE_MODEL=`, `AUTO_TRANSLATE_TIMEOUT_MS=30000`.

- [x] 验证生产和 VM Compose 配置及后台默认配置：默认关闭且密钥只传 CMS，不传 web 或 build args。
- [x] 加入 env/Compose 配置，并写 VM 单条命令部署说明；env 更新使用 `up -d --no-deps --force-recreate cms`，不是 restart。
- [x] 文档明确添加 en/zh-Hans 内容语言、角色 locale 权限、接口配置、发布触发/覆盖行为、失败恢复及真实翻译质量验收。
- [x] 运行 `npm.cmd test` 和 `npm.cmd run build:cms`，检查 `git diff --check`、作用域及测试证据，交付使用已授权的提交推送流程。

### Task 4: 初始化中文 FAQ

**Files:** Create `apps/cms/src/data/demo-faqs.zh-Hans.json`, `apps/cms/tests/seed-locales.test.mjs`; modify `apps/cms/src/seed.ts`, `apps/cms/src/index.ts`, `docs/operations/strapi-content-workflow.md`.

**Interfaces:** `prepareDevelopmentLocales(strapi): Promise<void>` precedes role provisioning; `seedDevelopmentContent(strapi): Promise<void>` backfills only exact published demo FAQ content.

- [x] 实查 VM 两种语言的公开 FAQ，确认英文为四条初始记录、中文为空。
- [x] 在开发种子测试中断言补齐同 documentId 的四条中文发布记录，重启不重复、不覆盖人工草稿；观察原实现失败。
  ```js
  await seedDevelopmentContent(strapi);
  assert.equal(homepage.faqs[0][0], '可以定制哪些内容？');
  ```
- [x] 准备四条忠实中文译文，开发模式初始化语言并在事务内补齐；生产和关闭演示初始化时无写入。
- [x] 用实际 homepage controller 验证补齐后的中文问答进入公开返回值，运行 CMS 原有权限和内容接口测试。

计划自查：覆盖配置缺失、两向同步、权限、递归、错误回滚、隐私及实际服务未配置的限制；没有 UI 或付费计划依赖。补充任务解决用户报告的初始化 FAQ 缺失，使用已有演示内容，不修改前端语言隔离规则。
