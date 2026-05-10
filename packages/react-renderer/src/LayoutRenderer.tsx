import type { ResolvedLayoutNode } from "@webkitfxv2/core-engine";
import { FieldBlock } from "./FieldBlock.js";

export function LayoutRenderer({ node }: { node: ResolvedLayoutNode }) {
  switch (node.type) {
    case "field":
      return <FieldBlock key={node.fieldId} fieldId={node.fieldId} />;
    case "stack":
      return (
        <div
          key={nodeKey(node)}
          className={["webkitfx-stack", node.className].filter(Boolean).join(" ")}
          data-axis={node.axis ?? "vertical"}
          style={{ gap: node.gap }}
        >
          {node.children.map((c) => (
            <LayoutRenderer key={childKey(c)} node={c} />
          ))}
        </div>
      );
    case "grid":
      return (
        <div
          key={nodeKey(node)}
          className={["webkitfx-grid", node.className].filter(Boolean).join(" ")}
          style={{ gridTemplateColumns: node.columns ?? "1fr" }}
        >
          {node.children.map((c) => (
            <LayoutRenderer key={childKey(c)} node={c} />
          ))}
        </div>
      );
    case "region":
      return (
        <fieldset
          key={nodeKey(node)}
          className={["webkitfx-region", node.className].filter(Boolean).join(" ")}
          data-name={node.name}
        >
          {node.children.map((c) => (
            <LayoutRenderer key={childKey(c)} node={c} />
          ))}
        </fieldset>
      );
    default: {
      const _never: never = node;
      return _never;
    }
  }
}

function nodeKey(n: ResolvedLayoutNode): string {
  if (n.type === "field") return n.fieldId;
  return `${n.type}-${n.className ?? ""}-${stableChildSig(n)}`;
}

function childKey(n: ResolvedLayoutNode): string {
  if (n.type === "field") return n.fieldId;
  return nodeKey(n);
}

function stableChildSig(n: Extract<ResolvedLayoutNode, { children: unknown[] }>): string {
  return n.children.map((c) => (c.type === "field" ? c.fieldId : c.type)).join("/");
}
