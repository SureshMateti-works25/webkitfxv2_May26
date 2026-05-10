import type { ResolvedLayoutNode } from "@webkitfxv2/core-engine";

export function fieldIdsInResolvedLayout(root: ResolvedLayoutNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: ResolvedLayoutNode) => {
    if (n.type === "field") ids.add(n.fieldId);
    else for (const c of n.children) walk(c);
  };
  walk(root);
  return ids;
}
