import { setAtPath } from "./paths.js";
import type { FieldDefinition, FormDefinition } from "./types.js";

export function buildDefaultValues(fields: Record<string, FieldDefinition>): Record<string, unknown> {
  let acc: Record<string, unknown> = {};
  for (const f of Object.values(fields)) {
    if ("default" in f && f.default !== undefined) {
      acc = setAtPath(acc, f.binding, f.default) as Record<string, unknown>;
    }
  }
  return acc;
}

export function mergeFormMetaDefaults(form: FormDefinition, base: unknown): unknown {
  const defs = form.meta?.defaultValues;
  if (defs && typeof defs === "object" && !Array.isArray(defs)) {
    return {
      ...(typeof base === "object" && base !== null && !Array.isArray(base) ? base : {}),
      ...defs
    };
  }
  return base;
}
