import type {
  FieldDefinition,
  FormDefinition,
  JsonObject,
  LayoutNode,
  LayoutTemplateDefinition,
  ResolvedLayoutNode,
  TemplateCatalog
} from "./types.js";

export class LayoutResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutResolutionError";
  }
}

export function resolveFormLayout(
  form: FormDefinition,
  catalog: TemplateCatalog | undefined
): ResolvedLayoutNode {
  const templates = catalog?.templates ?? {};
  let root: LayoutNode;
  if (form.layout) root = form.layout;
  else if (form.layoutTemplateRef) {
    const t = templates[form.layoutTemplateRef];
    if (!t) {
      throw new LayoutResolutionError(`Unknown layoutTemplateRef "${form.layoutTemplateRef}"`);
    }
    root = t.root;
  } else {
    throw new LayoutResolutionError("Form must define `layout` or `layoutTemplateRef`");
  }
  return expandNode(root, templates, new Set());
}

function expandNode(
  node: LayoutNode,
  templates: Record<string, LayoutTemplateDefinition>,
  stack: Set<string>
): ResolvedLayoutNode {
  switch (node.type) {
    case "field":
      return { type: "field", fieldId: node.fieldId };
    case "stack":
      return { ...node, children: node.children.map((c) => expandNode(c, templates, stack)) };
    case "grid":
      return { ...node, children: node.children.map((c) => expandNode(c, templates, stack)) };
    case "region":
      return { ...node, children: node.children.map((c) => expandNode(c, templates, stack)) };
    case "slot":
      throw new LayoutResolutionError('Unresolved "slot" — only valid inside templates');
    case "template": {
      if (stack.has(node.ref)) {
        throw new LayoutResolutionError(`Template cycle at "${node.ref}"`);
      }
      const def = templates[node.ref];
      if (!def) throw new LayoutResolutionError(`Unknown template ref "${node.ref}"`);
      stack.add(node.ref);
      const merged = mergeSlots(def.root, node.slots ?? {}, templates, stack);
      stack.delete(node.ref);
      return node.props ? applyTemplateInstanceProps(merged, node.props) : merged;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function mergeSlots(
  templateRoot: LayoutNode,
  slotFragments: Record<string, LayoutNode[]>,
  templates: Record<string, LayoutTemplateDefinition>,
  stack: Set<string>
): ResolvedLayoutNode {
  const walk = (n: LayoutNode): ResolvedLayoutNode => {
    if (n.type === "slot") {
      const frag = slotFragments[n.name];
      if (!frag || frag.length === 0) {
        return { type: "region", name: `empty:${n.name}`, children: [] };
      }
      if (frag.length === 1) {
        const only = frag[0];
        if (!only) return { type: "region", name: `empty:${n.name}`, children: [] };
        return expandNode(only, templates, stack);
      }
      return {
        type: "stack",
        axis: "vertical",
        children: frag.map((c) => expandNode(c, templates, stack))
      };
    }
    if (n.type === "stack") return { ...n, children: n.children.map(walk) };
    if (n.type === "grid") return { ...n, children: n.children.map(walk) };
    if (n.type === "region") return { ...n, children: n.children.map(walk) };
    if (n.type === "field") return n;
    if (n.type === "template") return expandNode(n, templates, stack);
    const _never: never = n;
    return _never;
  };
  return walk(templateRoot);
}

function applyTemplateInstanceProps(
  node: ResolvedLayoutNode,
  props: JsonObject
): ResolvedLayoutNode {
  const cn = props.className;
  if (typeof cn !== "string" || cn.length === 0) return node;
  if (node.type === "field") {
    return { type: "region", name: "template-root", className: cn, children: [node] };
  }
  return { ...node, className: [node.className, cn].filter(Boolean).join(" ") };
}

export interface FieldPlacement {
  fieldId: string;
  field: FieldDefinition;
}

export function collectFieldPlacements(
  form: FormDefinition,
  resolved: ResolvedLayoutNode
): FieldPlacement[] {
  const seen = new Set<string>();
  const ordered: FieldPlacement[] = [];

  const visit = (n: ResolvedLayoutNode) => {
    if (n.type === "field") {
      if (seen.has(n.fieldId)) return;
      const f = form.fields[n.fieldId];
      if (!f) throw new LayoutResolutionError(`Unknown fieldId "${n.fieldId}"`);
      seen.add(n.fieldId);
      ordered.push({ fieldId: n.fieldId, field: f });
      return;
    }
    if (n.type === "stack" || n.type === "grid" || n.type === "region") {
      for (const c of n.children) visit(c);
    }
  };

  visit(resolved);
  for (const id of Object.keys(form.fields)) {
    if (!seen.has(id)) {
      const field = form.fields[id];
      if (field) ordered.push({ fieldId: id, field });
    }
  }
  return ordered;
}
