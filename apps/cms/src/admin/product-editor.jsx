import React, { useEffect, useRef, useState } from "react";
import { useField, useFetchClient } from "@strapi/admin/strapi-admin";
import styled from "styled-components";
import { readProductDetail, writeProductDetail } from "./product-editor-data.mjs";

export const Editor = styled.div`
  color: ${({ theme }) => theme.colors.neutral800}; font-size: 14px; line-height: 1.6;
  .pe-label { display: block; font-weight: 600; margin-bottom: 8px; }
  .pe-hint { color: ${({ theme }) => theme.colors.neutral600}; margin: 6px 0 14px; }
  .pe-guide { padding: 12px 16px; border-left: 3px solid ${({ theme }) => theme.colors.primary600}; background: ${({ theme }) => theme.colors.neutral100}; margin-bottom: 20px; }
  .pe-guide strong { display: block; font-size: 16px; }
  input, textarea, select { display: block; width: 100%; box-sizing: border-box; border: 1px solid ${({ theme }) => theme.colors.neutral300}; border-radius: 4px; padding: 10px 12px; background: ${({ theme }) => theme.colors.neutral0}; color: inherit; font: inherit; }
  textarea { resize: vertical; min-height: 90px; }
  input:focus, textarea:focus, select:focus { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: 1px; }
  input:disabled, textarea:disabled, select:disabled, button:disabled { opacity: .6; cursor: not-allowed; }
  button { font: inherit; cursor: pointer; border: 1px solid ${({ theme }) => theme.colors.neutral300}; background: ${({ theme }) => theme.colors.neutral0}; color: inherit; border-radius: 4px; padding: 6px 10px; }
  .pe-add { color: ${({ theme }) => theme.colors.primary600}; margin-top: 12px; font-weight: 600; }
  .pe-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 14px 0; border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200}; }
  .pe-inputs { min-width: 0; display: grid; gap: 10px; }
  .pe-pair { grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); }
  .pe-actions { display: flex; align-items: start; gap: 5px; }
  h3 { font-size: 15px; font-weight: 600; margin: 20px 0 8px; }
  .pe-error { color: ${({ theme }) => theme.colors.danger600}; }
  .pe-empty { padding: 12px; background: ${({ theme }) => theme.colors.neutral100}; }
  @media (max-width: 1000px) { .pe-pair { grid-template-columns: 1fr; } .pe-actions { flex-direction: column; } }
`;

export function Frame({ name, label, hint, error, children }) {
  return <Editor data-product-editor={name}><span className="pe-label" id={`${name}-label`}>{label}</span><p className="pe-hint" id={`${name}-hint`}>{hint}</p>{children}{error && <p role="alert" className="pe-error">{error}</p>}</Editor>;
}

export function RowActions({ index, rows, onChange, disabled, label }) {
  const move = offset => { const next = [...rows]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; onChange(next); };
  return <div className="pe-actions">
    <button type="button" disabled={disabled || index === 0} aria-label={`上移${label}${index + 1}`} onClick={() => move(-1)}>↑</button>
    <button type="button" disabled={disabled || index === rows.length - 1} aria-label={`下移${label}${index + 1}`} onClick={() => move(1)}>↓</button>
    <button type="button" disabled={disabled} aria-label={`删除${label}${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>删除</button>
  </div>;
}

export function ProductTitleInput(props) {
  const field = useField(props.name);
  return <Frame {...props} error={field.error}><div className="pe-guide"><strong>产品页面编辑</strong>按顺序填写以下内容。右上角切换网站语言；保存只更新草稿，发布后才会同步到前台（通常约 30 秒）。</div><input aria-label={props.label} aria-describedby={`${props.name}-hint`} name={props.name} value={field.value ?? ""} disabled={props.disabled} required={props.required} onChange={field.onChange}/></Frame>;
}

export function ProductCategoryInput(props) {
  const field = useField(props.name);
  const { get } = useFetchClient();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const rows = []; let page = 1, pageCount = 1;
      do {
        const { data } = await get("/api/product-categories", { params: { pagination: { page, pageSize: 100 } } });
        rows.push(...data.data); pageCount = data.meta.pagination.pageCount; page++;
      } while (page <= pageCount && page <= 1000);
      if (active) { setCategories(rows); setLoading(false); }
    })().catch(() => { if (active) { setFailed(true); setLoading(false); } });
    return () => { active = false; };
  }, [get]);
  return <Frame {...props} error={field.error}><select aria-label={props.label} value={field.value ?? ""} disabled={props.disabled || loading || failed} onChange={event => field.onChange(props.name, event.target.value || null)}>
    <option value="">请选择产品分类</option>
    {[{ key: "modular-buildings", name: "房屋" }, { key: "electrical", name: "电气设备" }].map(division => <optgroup key={division.key} label={division.name}>{categories.filter(category => category.division === division.key).map(category => <option key={category.key} value={category.key}>{category.nameZh || category.nameEn} / {category.nameEn}{category.visible === false ? "（菜单隐藏）" : ""}</option>)}</optgroup>)}
    {field.value && !categories.some(category => category.key === field.value) && <option value={field.value}>原有分类（保留）：{field.value}</option>}
  </select>{loading && <p className="pe-hint">正在读取后台产品分类…</p>}{failed && <p role="alert" className="pe-error">无法读取已发布的产品分类，请确认后台服务连接正常，并刷新重试。当前分类已保留。</p>}</Frame>;
}

export function CategoryLocationInput(props) {
  const field = useField(props.name);
  const group = useField("group");
  const choices = props.name === "division" ? [["modular-buildings", "房屋"], ["electrical", "电气设备"]] : [["none", "不分组（房屋分类选此项）"], ["transformers", "变压器 / Transformers"], ["switchgear", "开关设备 / Switchgear"], ["substations", "变电站 / Substations"]];
  return <Frame {...props} error={field.error}><select aria-label={props.label} value={field.value ?? ""} disabled={props.disabled} onChange={event => { field.onChange(props.name, event.target.value); if (props.name === "division" && event.target.value === "modular-buildings") group.onChange("group", "none"); }}><option value="" disabled>请选择</option>{choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Frame>;
}

export function ProductDetailInput(props) {
  const field = useField(props.name);
  const [draft, setDraft] = useState(() => readProductDetail(field.value));
  const emitted = useRef(field.value);
  useEffect(() => {
    if (field.value !== emitted.current) { emitted.current = field.value; setDraft(readProductDetail(field.value)); }
  }, [field.value]);
  const update = next => { setDraft(next); const value = writeProductDetail(field.value, next); emitted.current = value; field.onChange(props.name, value); };
  const updateRows = specifications => update({ ...draft, specifications });
  return <Frame {...props} error={field.error}>
    <label className="pe-label" htmlFor={`${props.name}-description`}>产品详细介绍</label>
    <textarea id={`${props.name}-description`} rows={6} value={draft.description} disabled={props.disabled} placeholder="填写用途、产品特点、交付说明等介绍文字" onChange={event => update({ ...draft, description: event.target.value })}/>
    <h3>技术参数（名称 / 数值）</h3><p className="pe-hint">例如 Overall dimensions / 5,900 × 6,300 × 2,480 mm。参数名称避免使用冒号；填写完整的行才会在前台作为参数展示。</p>
    {!draft.specifications.length && <p className="pe-empty">尚未填写技术参数，点击下方按钮添加。</p>}
    {draft.specifications.map((row, index) => <div className="pe-row" key={index}><div className="pe-inputs pe-pair">
      <input aria-label={`参数名称${index + 1}`} value={row.label} maxLength={90} disabled={props.disabled} placeholder="参数名称，如 Overall dimensions" onChange={event => updateRows(draft.specifications.map((item, i) => i === index ? { ...item, label: event.target.value.replace(/[:：\r\n]/g, "") } : item))}/>
      <input aria-label={`参数数值${index + 1}`} value={row.value} disabled={props.disabled} placeholder="数值及单位，如 5,900 mm" onChange={event => updateRows(draft.specifications.map((item, i) => i === index ? { ...item, value: event.target.value } : item))}/>
    </div><RowActions index={index} rows={draft.specifications} onChange={updateRows} disabled={props.disabled} label="参数"/></div>)}
    <button className="pe-add" type="button" disabled={props.disabled} onClick={() => updateRows([...draft.specifications, { label: "", value: "" }])}>＋ 添加技术参数</button>
  </Frame>;
}

export function ProductRowsInput(props) {
  const field = useField(props.name);
  const faq = props.name === "productFaqs";
  const rows = field.value ?? [];
  const valid = Array.isArray(rows) && rows.every(row => faq ? row && typeof row.question === "string" && typeof row.answer === "string" : typeof row === "string");
  const label = faq ? "问题" : "配置";
  const update = value => field.onChange(props.name, value);
  if (!valid) return <Frame {...props}><p className="pe-error">此产品的旧数据格式需要开发人员确认，已保留原内容，请勿覆盖。</p></Frame>;
  return <Frame {...props} error={field.error}>
    {!rows.length && <p className="pe-empty">{faq ? "当前使用网站默认 FAQ。添加后，前台使用本产品填写的问题和答案。" : "尚未填写配置选项，点击下方按钮添加。"}</p>}
    {rows.map((row, index) => <div className="pe-row" key={index}><div className="pe-inputs">
      {faq ? <><input aria-label={`问题${index + 1}`} value={row.question} disabled={props.disabled} placeholder="客户常问的问题" onChange={event => update(rows.map((item, i) => i === index ? { ...item, question: event.target.value } : item))}/><textarea aria-label={`答案${index + 1}`} value={row.answer} disabled={props.disabled} placeholder="问题的具体答复" onChange={event => update(rows.map((item, i) => i === index ? { ...item, answer: event.target.value } : item))}/></> : <input aria-label={`配置选项${index + 1}`} value={row} disabled={props.disabled} placeholder="如 Double-glazed windows" onChange={event => update(rows.map((item, i) => i === index ? event.target.value : item))}/>}
    </div><RowActions index={index} rows={rows} onChange={update} disabled={props.disabled} label={label}/></div>)}
    {faq && rows.some(row => !row.question.trim() || !row.answer.trim()) && <p className="pe-hint">请填写完整的问题和答案；不完整的条目不会展示到前台。</p>}
    <button className="pe-add" type="button" disabled={props.disabled} onClick={() => update([...rows, faq ? { question: "", answer: "" } : ""])}>＋ 添加{faq ? "常见问题" : "配置选项"}</button>
  </Frame>;
}
