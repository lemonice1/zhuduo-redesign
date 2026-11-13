# 自动翻译与同步发布

填写一种语言的公开内容，在后台点击「发布」，自动翻译为 Internationalization 中已添加的其他语言并一并发布。适用于产品、项目案例、文章、证书、FAQ 和网站设置；使用同一条内容的 documentId。不会自动翻译询盘、内部备注或后台账户。

功能默认关闭。没有翻译服务接口时，需要手动编辑和发布各语言；当前四条初始化 FAQ 的中文补齐使用已准备好的译文，不需要 API。自动翻译需要自行开通一个支持 Chat Completions 和 JSON 输出的服务，在服务器配置密钥。服务可能按使用量收费；本项目不包含翻译额度。

## VM 配置

在 `http://192.168.200.7:1337/admin` 的 Settings / 设置 → Internationalization / 国际化中确认有 `en`、`ar` 和 `fr`。前台语言选择使用这三个代码。阿拉伯语、法语内容初始化和生产配置参见 [网站语言](site-languages.md)。已有中文内容保留，自动翻译目标为英语、阿拉伯语和法语。

使用超级管理员，或确保 Operations 角色对源语言及**每一个目标语言**均有读取、创建/编辑、发布及全部本地化字段权限。角色在首次初始化时读取已有语言列表；后来添加的语言不会擅自扩大既有角色权限，管理员需要在角色设置中补选。

在 `/opt/www/web/.env` 追加配置，填写服务商提供的完整 Chat Completions URL、实际模型名和 API Key：

```dotenv
AUTO_TRANSLATE_ENABLED=true
AUTO_TRANSLATE_API_URL=https://your-service.example/v1/chat/completions
AUTO_TRANSLATE_API_KEY=你的真实接口密钥
AUTO_TRANSLATE_MODEL=服务商提供的模型名
AUTO_TRANSLATE_TIMEOUT_MS=30000
```

上面 URL 是格式说明，须替换为真实服务地址。密钥直接填到 VM 的 `.env`，无需发到聊天，也不要提交到 Git。本配置仅传入 CMS，前台与镜像 build args 不接收。

在 VM 分别执行：

```bash
git pull --ff-only origin codex/complete-development-plan
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env up -d --no-deps --force-recreate cms
```

```bash
docker compose -f docker-compose.vm-dev.yml --env-file .env ps
```

更新 `.env` 后必须重建容器才能应用新环境变量；`restart` 不重新注入环境变量。代码修改仍由开发环境绑定挂载，重建 CMS 无需重新安装依赖。生产环境须构建新的 CMS 镜像并部署。

## 发布与检查

1. 新建或打开一条 FAQ，选择英语、阿拉伯语或法语，填写内容并点击发布。等待请求完成；翻译需要额外时间。
2. 切换后台内容语言，确认其他已配置的前台语言已有已发布记录。任意当前语言都可作为源语言。
3. 等待约 30 秒后刷新前台，分别查看 `?lang=en`、`?lang=ar` 和 `?lang=fr`。缓存刷新后显示对应已发布内容。

成功同步会**覆盖同一内容在目标语言的现有草稿和译文**，不会覆盖其他文档。单击 Save / 保存只保存草稿，不触发翻译；普通发布和 Content Manager 按源语言批量发布会触发。不回填整个历史数据库，已有内容须逐条重新发布。目标发布不会再次递归翻译。

取消发布仍按 Strapi 原生行为，仅处理当前选择的语言。不要将取消发布视为所有语言一起下线。

接口只接收公开内容的本地化文本；图片、附件、slug、排序和联系邮箱由 Strapi 保持原值。JSON 字段的键、数组结构、数字与 null 保留，只翻译其中的文本。单条内容最多 20,000 字符 / 1,000 个文本片段；接口超时可设为 1–120,000 毫秒。

配置缺失、接口不可达、译文格式不完整、权限不足或数据库发布失败，会取消本次同步发布并保留此前的线上版本。修正配置后重新发布。已保存的草稿可继续编辑；和发布一起提交但未单独保存的更改会随发布事务回滚。翻译期间如果检测到源或目标草稿发生变化，也会要求重新发布。

本地协议、权限和事务流程已使用测试翻译服务验证；实际服务的连通性、额度、模型速度和译文质量需要配置后验收。建议先用一条 FAQ 检查术语和语气，再发布正式产品或认证说明。

关闭自动翻译：将 `AUTO_TRANSLATE_ENABLED=false`，重建 CMS 容器。各语言现有内容不会被删除，恢复手动发布。
