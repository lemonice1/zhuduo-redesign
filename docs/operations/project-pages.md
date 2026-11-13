# Projects 项目详情页

后台入口：**Collection Types → Project Case**。本次只增加可选字段，不迁移、覆盖或发布原有项目。

## 编辑与发布

表单分为基本资料、首屏展示、图文与特点、细节与证书、视频与生产、案例与运输、常见问题七个区域。按中文说明填写即可，无需编辑 JSON。

- 标题、简介、地点、使用产品、数量和介绍填写当前语言的内容。右上角切换 English、French 或 Arabic；阿拉伯语只调整文字阅读方向，页面仍保持左图右信息。
- 网址标识 `slug` 用于 `/projects/featured-projects/[slug]?lang=en`。建议采用英文小写和短横线。已有项目的网址标识不要随意修改；旧项目缺少标识时保留列表展示，但没有详情入口。
- 主图和相册在首屏完整显示，可用缩略图或左右按钮切换。图库不会自动裁切图片。
- 补充参数、项目特点、FAQ 使用逐条填写控件，可添加、删除和上下排序。参数与 FAQ 必须填写完整的一行才公开显示；打开编辑器不会转换或重写旧内容。
- 项目介绍使用原有 Markdown 编辑器，支持文字中插入媒体库图片。
- 媒体字段继续使用 Strapi 媒体库，可调整顺序。生产步骤文字逐条填写，与流程图片顺序一一对应，支持当前语言编辑和自动翻译；该步骤文字留空时使用图片的 **caption / 说明文字**。其他图集也可使用媒体说明。
- 视频从媒体库上传，用户点击播放，不自动播放。证书图片统一尺寸并完整显示，只上传可公开且确实适用的资料。
- 未填写的可选模块直接隐藏，正式详情不填入示例内容。FAQ 默认全部关闭。
- **Save / 保存只更新草稿**。发布且勾选“已核实，可公开展示”后才进入正式详情；前台读取发布内容，通常约 30 秒更新。修改后需再次发布。
- 已启用的自动翻译流程继续支持新增文本及逐条内容；共享媒体不发送给翻译服务。生产步骤文字按页面语言维护；媒体库本身的图片说明仍为共享内容。

项目列表仍沿用现有最多三个已核实项目的展示规则，点击标题、图片或 Learn More 进入对应详情。

## 业务角色权限

已有 Operations 等自定义角色不会自动增加权限，也不会重置人工配置。管理员需在 **Settings → Administration panel → Roles → 对应角色 → Collection Types → Project Case** 中授予所需语言、读取、创建、修改和发布权限，并确认下列新增字段已勾选：

`projectFacts`、`features`、`projectFaqs`、`introImage`、`detailImages`、`certificateImages`、`video`、`productionText`、`productionImages`、`productionSteps`、`referenceImages`、`shippingText`、`shippingImages`。

媒体上传和选择还需要 Media Library 权限。自动翻译发布需要源语言读取、目标语言创建/修改，以及各语言发布权限。新安装时创建的默认 Operations 角色包含这些字段；已有角色仍需人工授权。

## 公开接口与询盘

`GET /api/project-cases/slug/:slug?locale=en` 仅公开指定语言中已发布且 `isVerified=true` 的项目，支持 `en`、`fr`、`ar`。不存在、未发布、未核实或未发布该语言时返回 404。数组和 `locale=all` 不被接受。调用者不能通过 `status`、`filters`、`fields` 或 `populate` 放宽查询和公开字段范围。

详情页只显示一份询盘表单，复用原有验证和保存接口。`Inquiry.source` 通常记录为 `project:/projects/featured-projects/[slug]`；当网址过长、超过既有询盘字段限制时，改用 `project:[documentId]` 保留准确身份。

## 示例与回退

没有真实项目时，列表占位项跳转 `/preview/projects/sample-project?lang=en`，也支持 `fr`、`ar`。示例使用本地产品图片、公司视频和明确标注的中性证书占位图，不代表真实项目或认证。此页设置 `noindex,nofollow`，表单与聊天组件均为演示模式，不保存询盘。

需要撤回一个项目时取消核实并发布，或取消发布相应语言。若回退代码，可恢复此前版本并保留新增数据库字段；不要删除字段或批量修改项目数据。部署仍按现有 ECS 约定另行执行。
