# 已确认预览的正式首页

首页将交互预览中的森林绿、米白、衬线标题、左右分栏首屏和照片卡片迁入 Next.js。桌面与手机均支持导航、手动轮播、分类筛选、产品与应用场景弹窗、FAQ、文字目录下载及项目询盘。

## 内容和交互

- 产品、分类、详情、配置选项、FAQ 和网站设置来自 Strapi 已发布内容。首屏展示前三款，更多产品可展开；当前聚合接口最多返回 12 款。
- `?lang=en` 读取 CMS `en`，`?lang=zh` 读取 `zh-Hans`。导航与表单文案随语言切换。语言偏好保存在浏览器，显式 URL 优先。请在 Strapi 添加并发布简体中文内容；空语言显示说明，不复制英文冒充译文。
- 首页场景照片为有来源记录的建筑参考摄影。没有产品图片或图片加载失败时，卡片回退为带说明的参考图片。上传真实产品图片后自动替换。
- 下载内容为当前语言已发布产品的 UTF-8 `.txt` 目录，不提供虚构尺寸或价格。
- 产品弹窗进入询盘时预选该产品，应用场景进入询盘时记录来源。询盘调用现有 Next.js → Strapi 服务，只有收到有效保存编号才显示成功。失败时保留表单，验证开启时需要有效 Turnstile 凭据。
- 弹窗支持 Escape、背景关闭与关闭后焦点恢复。移动菜单可键盘操作，减少动态效果设置生效。

## 更新现有 VM

在项目目录逐条执行。沿用现有 `.env` 与数据卷。

```bash
git pull --ff-only origin codex/complete-development-plan
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env restart cms web
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env ps -a
```

CMS 重启完成后访问 `http://192.168.200.7:3000`。新代码增加产品分类字段，旧 CMS 响应会临时从已有 eyebrow 读取分类；仍建议同时重启 CMS 与前台。

## 本地验证

```bash
npm test
npm run build:web
npm run test:smoke
```

`tests/smoke/homepage-browser.mjs` 在已构建页面上使用 Playwright 检查 1440、768、390、320 像素布局，验证产品筛选、图片回退、焦点恢复、询盘成功 / 失败 / 缺失回执、语言切换、下载与移动导航。需要已安装 Playwright 和 Chromium；若 Playwright 位于外部运行环境，将 `PLAYWRIGHT_PACKAGE_JSON` 指向该环境的 `package.json`，然后运行：

```bash
node tests/smoke/homepage-browser.mjs
```

截图与结果保存在忽略提交的 `.cache/homepage-browser/`。此测试使用本机 CMS 和验证组件替身，不会向 VM 写入测试询盘，也不等于 VM 数据库端到端验收。

照片来源和字体许可证见 `apps/web/public/living/`。这是已确认预览的独立实现，使用本项目品牌及 CMS 数据。
