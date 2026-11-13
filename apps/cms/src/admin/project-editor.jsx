import React from "react";
import { useField } from "@strapi/admin/strapi-admin";
import { Frame, RowActions } from "./product-editor";
import { projectRowShape } from "./project-editor-data.mjs";

export function ProjectRowsInput(props) {
  const field = useField(props.name);
  const rows = field.value ?? [];
  const keys = projectRowShape(props.name);
  const valid = Array.isArray(rows) && rows.every(row => keys.length ? row && keys.every(key => typeof row[key] === "string") : typeof row === "string");
  const labels = props.name === "projectFacts" ? ["参数名称", "参数内容"] : props.name === "projectFaqs" ? ["问题", "答案"] : props.name === "productionSteps" ? ["步骤文字"] : ["特点"];
  const update = next => field.onChange(props.name, next);
  if (!valid) return <Frame {...props} error={field.error}><p className="pe-error">旧数据格式需要开发人员确认，已保留原内容，请勿覆盖。</p></Frame>;
  return <Frame {...props} error={field.error}>
    {!rows.length && <p className="pe-empty">尚未填写，点击下方按钮添加。留空时前台隐藏此部分。</p>}
    {rows.map((row, index) => <div className="pe-row" key={index}><div className="pe-inputs">
      {(keys.length ? keys : [null]).map((key, k) => {
        const Input = key === "answer" ? "textarea" : "input";
        return <Input key={key || "feature"} aria-label={`${labels[k]}${index + 1}`} placeholder={labels[k]} value={key ? row[key] : row} disabled={props.disabled} onChange={event => update(rows.map((item, i) => i === index ? key ? { ...item, [key]: event.target.value } : event.target.value : item))}/>;
      })}
    </div><RowActions index={index} rows={rows} onChange={update} disabled={props.disabled} label={labels[0]}/></div>)}
    <button type="button" className="pe-add" disabled={props.disabled} onClick={() => update([...rows, keys.length ? Object.fromEntries(keys.map(key => [key, ""])) : ""])}>＋ 添加{labels[0]}</button>
  </Frame>;
}
