/** JSON shapes the engine consumes. Widget / format / custom ids are opaque. */

export type JsonObject = Record<string, unknown>;

export type LayoutNode =
  | StackLayout
  | GridLayout
  | RegionLayout
  | FieldRefLayout
  | TemplateRefLayout
  | SlotPlaceholderLayout;

export interface StackLayout {
  type: "stack";
  axis?: "vertical" | "horizontal";
  gap?: string;
  className?: string;
  children: LayoutNode[];
}

export interface GridLayout {
  type: "grid";
  columns?: string;
  className?: string;
  children: LayoutNode[];
}

export interface RegionLayout {
  type: "region";
  name: string;
  className?: string;
  children: LayoutNode[];
}

export interface FieldRefLayout {
  type: "field";
  fieldId: string;
}

export interface TemplateRefLayout {
  type: "template";
  ref: string;
  slots?: Record<string, LayoutNode[]>;
  props?: JsonObject;
}

export interface SlotPlaceholderLayout {
  type: "slot";
  name: string;
}

export interface LayoutTemplateDefinition {
  root: LayoutNode;
  meta?: JsonObject;
}

export interface TemplateCatalog {
  templates: Record<string, LayoutTemplateDefinition>;
}

/** Boolean expressions over form values (+ optional context). */
export type Condition =
  | { op: "true" }
  | { op: "false" }
  | { op: "empty"; path: string }
  | { op: "notEmpty"; path: string }
  | { op: "eq"; path: string; value: unknown }
  | { op: "neq"; path: string; value: unknown }
  | { op: "eqPath"; left: string; right: string }
  | { op: "and"; all: Condition[] }
  | { op: "or"; any: Condition[] }
  | { op: "not"; cond: Condition }
  | { op: "custom"; id: string; params?: JsonObject };

export type ValidationRule =
  | { kind: "required"; message?: string }
  | { kind: "minLength"; value: number; message?: string }
  | { kind: "maxLength"; value: number; message?: string }
  | { kind: "minimum"; value: number; message?: string }
  | { kind: "maximum"; value: number; message?: string }
  | { kind: "pattern"; regex: string; flags?: string; message?: string }
  | { kind: "minItems"; value: number; message?: string }
  | { kind: "maxItems"; value: number; message?: string }
  | { kind: "const"; value: unknown; message?: string }
  | { kind: "enum"; values: unknown[]; message?: string }
  | { kind: "eqPath"; path: string; message?: string }
  | { kind: "dateBefore"; path: string; message?: string }
  | { kind: "dateAfter"; path: string; message?: string }
  | { kind: "dateBeforeNow"; message?: string }
  | { kind: "dateAfterNow"; message?: string }
  | { kind: "format"; id: string; message?: string }
  | { kind: "custom"; id: string; params?: JsonObject; message?: string }
  | { kind: "allOf"; rules: ValidationRule[] }
  | { kind: "anyOf"; rules: ValidationRule[]; message?: string }
  | { kind: "not"; rule: ValidationRule; message?: string };

export interface FieldDefinition {
  binding: string;
  widget: string;
  label?: string;
  description?: string;
  props?: JsonObject;
  default?: unknown;
  rules?: ValidationRule[];
  /** When absent, field is visible. */
  visibleWhen?: Condition;
  /** When absent, field is enabled. */
  enabledWhen?: Condition;
}

export interface FormDefinition {
  id: string;
  title?: string;
  version?: string;
  layout?: LayoutNode;
  layoutTemplateRef?: string;
  fields: Record<string, FieldDefinition>;
  meta?: JsonObject;
}

export type ResolvedLayoutNode =
  | (Omit<StackLayout, "children"> & { children: ResolvedLayoutNode[] })
  | (Omit<GridLayout, "children"> & { children: ResolvedLayoutNode[] })
  | (Omit<RegionLayout, "children"> & { children: ResolvedLayoutNode[] })
  | FieldRefLayout;

export interface ValidationIssue {
  ruleKind: string;
  message: string;
  path: string;
  details?: JsonObject;
}

export interface RuleRegistry {
  formats: Record<string, (value: unknown) => boolean | Promise<boolean>>;
  customs: Record<
    string,
    (input: {
      value: unknown;
      values: unknown;
      params?: JsonObject;
      binding: string;
    }) => boolean | string | Promise<boolean | string>
  >;
}

export interface ConditionRegistry {
  customs: Record<
    string,
    (input: { values: unknown; params?: JsonObject }) => boolean | Promise<boolean>
  >;
}

export interface EngineContext {
  rules: RuleRegistry;
  conditions: ConditionRegistry;
}
