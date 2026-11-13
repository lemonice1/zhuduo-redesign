// Keep the existing rich-text/JSON storage contract. Opening an editor never writes data.
export function readProductDetail(value) {
  const paragraphs = [], specifications = [];
  for (const line of (typeof value === "string" ? value : "").split(/\r?\n/)) {
    const match = line.trim().match(/^([^:：]{0,90})[:：][ \t]*(.*)$/);
    if (match) specifications.push({ label: match[1], value: match[2] });
    else paragraphs.push(line);
  }
  return { description: paragraphs.join("\n"), specifications };
}

export function writeProductDetail(original, next) {
  if (JSON.stringify(readProductDetail(original)) === JSON.stringify(next)) return original;
  return [next.description, ...next.specifications.map(row => `${row.label}: ${row.value}`)].filter(Boolean).join("\n");
}

const fieldCopy = {
  title: ["1. 产品名称", "对应前台产品标题。填写当前语言的产品名称。"],
  categoryKey: ["所属产品分类", "选择房屋或电气设备下的具体分类，决定产品出现在哪个产品列表。"],
  category: ["原有分类文字（兼容字段）", "已有产品可保留。正式页面优先显示“产品分类”中设置的名称。新产品在此填写所选分类的当前语言名称。"],
  summary: ["产品简介", "对应标题下方的简介与产品概览。建议填写 1–3 句话。"],
  detail: ["2. 产品介绍与技术参数", "介绍显示在 Product overview；参数显示在 Technical specifications，前五条也用于 At a glance。"],
  customizableOptions: ["3. 配置与可选项", "逐条填写可选配置，如墙板、门窗、布局。对应产品概览和 Configuration and options。"],
  image: ["4. 产品主图", "用于列表卡片及详情页首图。优先使用上传的主图；建议上传清晰、完整的产品图片。"],
  gallery: ["产品相册", "可上传多张图片，用于详情页缩略图与图片展示。可拖动调整图片顺序。"],
  brochure: ["产品资料附件（PDF）", "上传产品手册或规格文件，前台显示资料链接；清空后隐藏链接。"],
  productFaqs: ["5. 产品常见问题（FAQ）", "逐条填写问题和答案，显示在页面底部询盘表单左侧。留空时沿用网站默认的四条 FAQ。"],
  slug: ["6. 产品网址标识（高级设置）", "用于产品链接。新产品根据名称生成；已有产品请尽量不要修改，避免原链接失效。"],
  imageUrl: ["备用图片地址（高级设置）", "历史数据的备用图片地址。上传主图后优先使用主图，通常无需填写。"],
  sourceReference: ["内部资料来源（不公开）", "内部记录或导入来源，不会显示在网站。"],
  sortOrder: ["列表排序", "数字越小，产品列表中越靠前。"],
  featured: ["推荐产品", "标记为推荐产品；是否展示取决于前台推荐区域设置。"]
};

export function businessProductLayout(input) {
  const fields = input.layout.layout.flat(2);
  // Other content types keep their own layouts and permission checks.
  if (!["categoryKey", "customizableOptions", "sourceReference"].every(name => fields.some(field => field.name === name))) return input;
  const mapped = new Map(fields.map(field => {
    const copy = fieldCopy[field.name];
    const type = { detail: "product-detail", customizableOptions: "product-options", productFaqs: "product-faqs", categoryKey: "product-category", title: "product-title" }[field.name];
    return [field.name, { ...field, ...(copy ? { label: copy[0], hint: copy[1] } : {}), ...(type ? { type } : {}) }];
  }));
  const groups = [
    [["title"], ["categoryKey", "category"], ["summary"]],
    [["detail"]], [["customizableOptions"]],
    [["image"], ["gallery"], ["brochure"]], [["productFaqs"]],
    [["slug"], ["sortOrder", "featured"], ["imageUrl"], ["sourceReference"]]
  ];
  const used = new Set();
  const layout = groups.map(panel => panel.map(row => row.filter(name => mapped.has(name)).map(name => {
    used.add(name);
    return { ...mapped.get(name), size: row.length === 2 ? 6 : 12 };
  })).filter(row => row.length)).filter(panel => panel.length);
  const extra = fields.filter(field => !used.has(field.name));
  if (extra.length) layout.push(extra.map(field => [field]));
  return { ...input, layout: { ...input.layout, layout } };
}

export function businessCategoryLayout(input) {
  const fields = input.layout.layout.flat(2);
  if (!["nameEn", "nameAr", "division", "group", "slug"].every(name => fields.some(field => field.name === name))) return input;
  const copy = {
    nameEn: ["英文分类名称", "显示在英文网站的菜单、分类页面和产品卡片中。"],
    nameFr: ["法语分类名称", "填写法语名称；留空时使用英文名称。三种语言在本页统一维护，无需切换语言。"],
    nameAr: ["阿拉伯语分类名称", "填写阿拉伯语名称；留空时使用英文名称。网站布局不会反转。"],
    nameZh: ["中文管理名称", "用于业务人员在产品分类选择框中识别分类，不增加网站中文版本。"],
    division: ["所属大类", "选择房屋或电气设备。保存后固定，避免原有链接失效。"],
    group: ["电气设备菜单分组", "房屋选择“不分组”；电气设备可选择变压器、开关设备、变电站或不分组。保存后固定。"],
    slug: ["分类网址标识", "根据英文名称生成，可在首次保存前调整。仅用小写英文、数字和短横线；保存后固定。"],
    sortOrder: ["显示顺序", "数字越小越靠前。电气设备分组按其最靠前分类的顺序排列。"],
    visible: ["在菜单中显示", "关闭并发布后收起菜单入口；已发布分类和产品的原网址仍可访问。有产品的分类不能直接删除或取消发布。"]
  };
  const mapped = new Map(fields.map(field => [field.name, { ...field, ...(copy[field.name] ? { label: copy[field.name][0], hint: copy[field.name][1] } : {}), ...(["division", "group"].includes(field.name) ? { type: "category-location" } : {}), size: 12 }]));
  const names = [["nameEn", "nameFr", "nameAr", "nameZh"], ["division", "group", "slug"], ["sortOrder", "visible"]];
  const used = new Set(names.flat());
  const layout = names.map(panel => panel.filter(name => mapped.has(name)).map(name => [mapped.get(name)]));
  const extra = fields.filter(field => !used.has(field.name));
  if (extra.length) layout.push(extra.map(field => [field]));
  return { ...input, layout: { ...input.layout, layout } };
}
