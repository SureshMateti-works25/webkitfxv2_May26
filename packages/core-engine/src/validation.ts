import { fieldVisible } from "./conditions.js";
import { getAtPath } from "./paths.js";
import type {
  ConditionRegistry,
  EngineContext,
  FieldDefinition,
  RuleRegistry,
  ValidationIssue,
  ValidationRule
} from "./types.js";

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export interface ValidateOptions {
  /** If true, skip rules for fields that fail `visibleWhen`. Default true. */
  skipHiddenFields?: boolean;
}

export async function validateFormFields(
  fields: Record<string, FieldDefinition>,
  values: unknown,
  ctx: EngineContext,
  options: ValidateOptions = {}
): Promise<Record<string, ValidationIssue[]>> {
  const skipHidden = options.skipHiddenFields !== false;
  const out: Record<string, ValidationIssue[]> = {};
  const condReg: ConditionRegistry = ctx.conditions;

  for (const field of Object.values(fields)) {
    if (skipHidden) {
      const vis = await fieldVisible(field.visibleWhen, values, condReg);
      if (!vis) continue;
    }
    const v = getAtPath(values, field.binding);
    const issues = await validateFieldRules(field.binding, v, values, field.rules, ctx.rules);
    if (issues.length) out[field.binding] = issues;
  }
  return out;
}

export async function validateFieldRules(
  binding: string,
  value: unknown,
  values: unknown,
  rules: ValidationRule[] | undefined,
  rulesReg: RuleRegistry
): Promise<ValidationIssue[]> {
  if (!rules?.length) return [];
  const issues: ValidationIssue[] = [];
  for (const rule of rules) {
    issues.push(...(await evaluateRule(binding, value, values, rule, rulesReg)));
  }
  return issues;
}

async function evaluateRule(
  binding: string,
  value: unknown,
  values: unknown,
  rule: ValidationRule,
  reg: RuleRegistry
): Promise<ValidationIssue[]> {
  switch (rule.kind) {
    case "required":
      if (isEmpty(value)) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Required", path: binding }];
      }
      return [];
    case "minLength":
      if (typeof value !== "string") return [];
      if (value.length < rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Minimum length is ${rule.value}`,
            path: binding,
            details: { min: rule.value }
          }
        ];
      }
      return [];
    case "maxLength":
      if (typeof value !== "string") return [];
      if (value.length > rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Maximum length is ${rule.value}`,
            path: binding,
            details: { max: rule.value }
          }
        ];
      }
      return [];
    case "minimum":
      if (typeof value !== "number" || Number.isNaN(value)) return [];
      if (value < rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Must be >= ${rule.value}`,
            path: binding,
            details: { minimum: rule.value }
          }
        ];
      }
      return [];
    case "maximum":
      if (typeof value !== "number" || Number.isNaN(value)) return [];
      if (value > rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Must be <= ${rule.value}`,
            path: binding,
            details: { maximum: rule.value }
          }
        ];
      }
      return [];
    case "pattern":
      if (typeof value !== "string") return [];
      if (!new RegExp(rule.regex, rule.flags ?? "").test(value)) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? "Does not match required pattern",
            path: binding
          }
        ];
      }
      return [];
    case "minItems":
      if (!Array.isArray(value)) return [];
      if (value.length < rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Pick at least ${rule.value} item(s)`,
            path: binding,
            details: { minItems: rule.value }
          }
        ];
      }
      return [];
    case "maxItems":
      if (!Array.isArray(value)) return [];
      if (value.length > rule.value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? `Pick at most ${rule.value} item(s)`,
            path: binding,
            details: { maxItems: rule.value }
          }
        ];
      }
      return [];
    case "const":
      if (value !== rule.value) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid value", path: binding }];
      }
      return [];
    case "enum":
      if (!rule.values.some((x) => x === value)) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Value is not allowed", path: binding }];
      }
      return [];
    case "eqPath": {
      const other = getAtPath(values, rule.path);
      if (other !== value) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? "Values must match",
            path: binding,
            details: { otherPath: rule.path }
          }
        ];
      }
      return [];
    }
    case "dateBefore": {
      const a = parseDate(value);
      const b = parseDate(getAtPath(values, rule.path));
      if (!a || !b) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid date", path: binding }];
      }
      if (!(a.getTime() < b.getTime())) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Date must be earlier", path: binding }];
      }
      return [];
    }
    case "dateAfter": {
      const a = parseDate(value);
      const b = parseDate(getAtPath(values, rule.path));
      if (!a || !b) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid date", path: binding }];
      }
      if (!(a.getTime() > b.getTime())) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Date must be later", path: binding }];
      }
      return [];
    }
    case "dateBeforeNow": {
      const a = parseDate(value);
      if (!a) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid date", path: binding }];
      }
      if (!(a.getTime() < Date.now())) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Must be in the past", path: binding }];
      }
      return [];
    }
    case "dateAfterNow": {
      const a = parseDate(value);
      if (!a) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid date", path: binding }];
      }
      if (!(a.getTime() > Date.now())) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Must be in the future", path: binding }];
      }
      return [];
    }
    case "format": {
      const fn = reg.formats[rule.id];
      if (!fn) {
        return [
          {
            ruleKind: rule.kind,
            message: `Unknown format "${rule.id}"`,
            path: binding,
            details: { formatId: rule.id }
          }
        ];
      }
      const ok = await fn(value);
      if (!ok) {
        return [
          {
            ruleKind: rule.kind,
            message: rule.message ?? "Invalid format",
            path: binding,
            details: { formatId: rule.id }
          }
        ];
      }
      return [];
    }
    case "custom": {
      const fn = reg.customs[rule.id];
      if (!fn) {
        return [
          {
            ruleKind: rule.kind,
            message: `Unknown custom rule "${rule.id}"`,
            path: binding,
            details: { customId: rule.id }
          }
        ];
      }
      const res = await fn({ value, values, params: rule.params, binding });
      if (res === true || res === undefined) return [];
      const message = typeof res === "string" ? res : "Invalid";
      return [{ ruleKind: rule.kind, message, path: binding, details: { customId: rule.id } }];
    }
    case "allOf": {
      const nested: ValidationIssue[] = [];
      for (const r of rule.rules) {
        nested.push(...(await evaluateRule(binding, value, values, r, reg)));
      }
      return nested;
    }
    case "anyOf": {
      for (const r of rule.rules) {
        const issues = await evaluateRule(binding, value, values, r, reg);
        if (issues.length === 0) return [];
      }
      return [
        {
          ruleKind: rule.kind,
          message: rule.message ?? "Did not satisfy any allowed rule",
          path: binding
        }
      ];
    }
    case "not": {
      const issues = await evaluateRule(binding, value, values, rule.rule, reg);
      if (issues.length === 0) {
        return [{ ruleKind: rule.kind, message: rule.message ?? "Invalid", path: binding }];
      }
      return [];
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}
