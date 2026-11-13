const copy = {
  title: ["1. 基本资料 · 项目标题", "填写当前语言内容。保存只更新草稿；发布且勾选“已核实”后，前台通常约 30 秒同步。"],
  slug: ["项目网址标识", "使用英文、数字和短横线。详情地址为 /projects/featured-projects/此标识；已有网址尽量不要修改。旧项目留空时保留列表展示。"],
  summary: ["项目简介", "用于项目列表和搜索引擎摘要。"],
  location: ["项目地点", "例如 London, United Kingdom。"],
  productName: ["使用产品", "例如 Expandable container houses。"],
  quantity: ["项目数量", "填写数量及单位，例如 12 units。"],
  application: ["应用场景", "可选，如 Accommodation / Site office。"],
  sortOrder: ["列表排序", "数字越小越靠前。"],
  isVerified: ["已核实，可公开展示", "仅已发布且已核实的项目可进入正式详情；未核实的项目不会出现在项目列表。"],
  image: ["2. 首屏展示 · 项目主图", "首屏大图及列表封面，完整显示。建议上传清晰图片。"],
  gallery: ["首屏相册", "使用媒体库上传并拖动排序；与主图一起用于缩略图和左右切换。"],
  projectFacts: ["补充参数", "逐条填写名称和内容，可增删和上下排序；不完整的行不会公开展示。"],
  imageUrl: ["历史备用图片地址", "保留原有数据。上传主图后优先使用主图，新项目通常无需填写。"],
  detail: ["3. 图文与特点 · 项目介绍", "支持 Markdown，可在文字中插入媒体库图片；空白时隐藏介绍文字。"],
  introImage: ["介绍配图", "展示在介绍文字左侧；请上传完整、清晰的图片。"],
  features: ["项目特点", "每行一个特点，可添加、删除及调整顺序。"],
  detailImages: ["4. 细节与证书 · 细节图集", "展示结构、材料或施工细节；媒体说明可作为图片下方的说明。"],
  certificateImages: ["证书图集", "仅上传允许公开且与本项目相关的证书。前台统一尺寸、完整显示。"],
  video: ["5. 视频与生产 · 项目视频", "从媒体库上传视频。前台点击播放，不自动播放。"],
  productionText: ["生产流程说明", "填写生产步骤的整体说明。"],
  productionImages: ["生产流程图片", "按步骤顺序添加图片，与下面的步骤文字一一对应。前台用箭头连接；调整图片顺序时请同步调整步骤文字。"],
  productionSteps: ["生产步骤文字", "按图片顺序逐条填写当前语言的步骤文字，支持自动翻译。某一步留空时使用媒体库的说明文字。"],
  referenceImages: ["6. 案例与运输 · 相关案例图片", "桌面端两列排列。媒体说明可填写案例名称。"],
  shippingText: ["装载与运输说明", "填写包装、装载、运输方式等说明。"],
  shippingImages: ["装载与运输图片", "多张图片可在媒体库拖动排序。"],
  projectFaqs: ["7. 常见问题 · FAQ", "逐条填写问题和答案；默认全部关闭。留空时隐藏，不自动使用示例 FAQ。"]
};

export function businessProjectLayout(input) {
  const fields = input.layout.layout.flat(2);
  // Use Strapi's schema display name, not a set of permitted fields: restricted roles
  // may only see a subset. Never add fields omitted by Strapi's permissions.
  if (input.layout.settings?.displayName !== "Project Case") return input;
  const types = { projectFacts: "project-rows", features: "project-rows", projectFaqs: "project-rows", productionSteps: "project-rows" };
  const mapped = new Map(fields.map(field => [field.name, { ...field, ...(copy[field.name] ? { label: copy[field.name][0], hint: copy[field.name][1] } : {}), ...(types[field.name] ? { type: types[field.name] } : {}), size: 12 }]));
  const groups = [
    ["title", "slug", "summary", "location", "productName", "quantity", "application", "sortOrder", "isVerified"],
    ["image", "gallery", "projectFacts", "imageUrl"], ["detail", "introImage", "features"],
    ["detailImages", "certificateImages"], ["video", "productionText", "productionImages", "productionSteps"],
    ["referenceImages", "shippingText", "shippingImages"], ["projectFaqs"]
  ];
  const used = new Set(groups.flat());
  const layout = groups.map(group => group.filter(name => mapped.has(name)).map(name => [mapped.get(name)])).filter(panel => panel.length);
  const extra = fields.filter(field => !used.has(field.name));
  if (extra.length) layout.push(extra.map(field => [field]));
  return { ...input, layout: { ...input.layout, layout } };
}

export function projectRowShape(name) {
  return name === "projectFacts" ? ["label", "value"] : name === "projectFaqs" ? ["question", "answer"] : [];
}
