/** Deep-merge plain objects for JSON form defaults (arrays and scalars from `b` replace). */
export function deepMergeFormSeed(
  base: Record<string, unknown>,
  seed: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(seed)) {
    if (v !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)) {
      const prev = out[k];
      if (prev !== null && typeof prev === "object" && !Array.isArray(prev)) {
        out[k] = deepMergeFormSeed(prev as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        out[k] = deepMergeFormSeed({}, v as Record<string, unknown>);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}
