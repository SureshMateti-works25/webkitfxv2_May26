import { getAtPath } from "./paths.js";
import type { Condition, ConditionRegistry } from "./types.js";

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export async function evaluateCondition(
  cond: Condition,
  values: unknown,
  registry: ConditionRegistry
): Promise<boolean> {
  switch (cond.op) {
    case "true":
      return true;
    case "false":
      return false;
    case "empty":
      return isEmpty(getAtPath(values, cond.path));
    case "notEmpty":
      return !isEmpty(getAtPath(values, cond.path));
    case "eq":
      return getAtPath(values, cond.path) === cond.value;
    case "neq":
      return getAtPath(values, cond.path) !== cond.value;
    case "eqPath":
      return getAtPath(values, cond.left) === getAtPath(values, cond.right);
    case "and": {
      for (const c of cond.all) {
        if (!(await evaluateCondition(c, values, registry))) return false;
      }
      return true;
    }
    case "or": {
      for (const c of cond.any) {
        if (await evaluateCondition(c, values, registry)) return true;
      }
      return false;
    }
    case "not":
      return !(await evaluateCondition(cond.cond, values, registry));
    case "custom": {
      const fn = registry.customs[cond.id];
      if (!fn) return false;
      return fn({ values, params: cond.params });
    }
    default: {
      const _never: never = cond;
      return _never;
    }
  }
}

export function fieldVisible(
  visibleWhen: Condition | undefined,
  values: unknown,
  registry: ConditionRegistry
): Promise<boolean> {
  if (!visibleWhen) return Promise.resolve(true);
  return evaluateCondition(visibleWhen, values, registry);
}

export function fieldEnabled(
  enabledWhen: Condition | undefined,
  values: unknown,
  registry: ConditionRegistry
): Promise<boolean> {
  if (!enabledWhen) return Promise.resolve(true);
  return evaluateCondition(enabledWhen, values, registry);
}
