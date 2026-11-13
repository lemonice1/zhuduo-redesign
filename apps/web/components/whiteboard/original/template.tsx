import { createElement, type ReactNode } from "react";
import source from "./templates.json";

type Node = string | { tag: string; props: Record<string, string | boolean | Record<string, string>>; children: Node[] };
const templates = source as unknown as Record<keyof typeof source, Node>;
export type ReferenceTemplateName = keyof typeof source;

// Bind values as React text/attributes, never as HTML. CMS markup cannot escape
// its content slot or install scripts, event handlers, or template selectors.
export default function ReferenceTemplate({ name, values = {}, slots = {} }: {
  name: ReferenceTemplateName; values?: Record<string, string>; slots?: Record<string, ReactNode>;
}) {
  const bind = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
  function render(node: Node, key: number): ReactNode {
    if (typeof node === "string") return bind(node);
    const props = Object.fromEntries(Object.entries(node.props).map(([key, value]) => [key, typeof value === "string" ? bind(value) : value]));
    if (node.tag === "a" && props.href === "" && String(props.className).includes("clickable_link")) return null;
    const slot = node.props["data-zd-slot"];
    const children = typeof slot === "string" ? slots[slot] : node.children.map(render);
    return createElement(node.tag, { ...props, key }, ...(Array.isArray(children) ? children : children === undefined ? [] : [children]));
  }
  return render(templates[name], 0);
}
