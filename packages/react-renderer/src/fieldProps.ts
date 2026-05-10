import type { JsonObject } from "@webkitfxv2/core-engine";
import type { CSSProperties } from "react";

/** Option rows for `select`, `multiselect`, and `radio` widgets (`field.props.options`). */
export type FieldOptionRow = { value: string; label?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readOptions(raw: unknown): FieldOptionRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldOptionRow[] = [];
  for (const row of raw) {
    if (typeof row === "string" || typeof row === "number") {
      const s = String(row);
      out.push({ value: s, label: s });
      continue;
    }
    if (!isRecord(row)) continue;
    const v = row["value"];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const value = String(v);
    const lab = row["label"];
    out.push({
      value,
      label: typeof lab === "string" ? lab : value
    });
  }
  return out;
}

const INPUT_ATTRS = new Set([
  "placeholder",
  "readOnly",
  "autoComplete",
  "autoFocus",
  "minLength",
  "maxLength",
  "min",
  "max",
  "step",
  "multiple",
  "accept",
  "capture",
  "list",
  "inputMode",
  "pattern",
  "size",
  "spellCheck",
  "tabIndex",
  "title",
  "form",
  "name"
]);

const TEXTAREA_ATTRS = new Set([
  "placeholder",
  "readOnly",
  "autoComplete",
  "autoFocus",
  "minLength",
  "maxLength",
  "rows",
  "cols",
  "wrap",
  "spellCheck",
  "tabIndex",
  "title",
  "form",
  "name"
]);

const SELECT_ATTRS = new Set([
  "readOnly",
  "autoFocus",
  "multiple",
  "size",
  "tabIndex",
  "title",
  "form",
  "name",
  "required"
]);

/** Whitelisted `field.props` keys passed through to native elements (JSON-safe). */
export function pickInputProps(props: JsonObject | undefined): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (INPUT_ATTRS.has(k)) out[k] = props[k];
  }
  return out;
}

export function pickTextareaProps(props: JsonObject | undefined): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (TEXTAREA_ATTRS.has(k)) out[k] = props[k];
  }
  return out;
}

export function pickSelectProps(props: JsonObject | undefined): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (SELECT_ATTRS.has(k)) out[k] = props[k];
  }
  return out;
}

export function readClassName(props: JsonObject | undefined): string | undefined {
  const cn = props?.["className"];
  return typeof cn === "string" && cn.length > 0 ? cn : undefined;
}

export function readStyle(props: JsonObject | undefined): CSSProperties | undefined {
  const s = props?.["style"];
  if (!s || typeof s !== "object" || Array.isArray(s)) return undefined;
  return s as CSSProperties;
}

export function readBooleanProp(props: JsonObject | undefined, key: string): boolean | undefined {
  const v = props?.[key];
  if (typeof v === "boolean") return v;
  return undefined;
}

export function readStringProp(props: JsonObject | undefined, key: string): string | undefined {
  const v = props?.[key];
  return typeof v === "string" ? v : undefined;
}
