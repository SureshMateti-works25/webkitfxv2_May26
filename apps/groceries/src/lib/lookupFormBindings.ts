import type { FieldDefinition, FormDefinition } from "@webkitfxv2/core-engine";
import type { FieldOptionRow } from "@webkitfxv2/react-renderer";
import raw from "../config/lookups/lookup-form-bindings.json";
import { CATALOG_PRODUCT_TYPE_ID, listCommerceLookupValues, type CommerceLookupValueDto } from "./commerceApi.js";
import { filterProductTypeLookupRowsForGroceries } from "./groceriesLookupFilters.js";
import type { LookupFormBindingsFile, LookupFormDropdownBinding } from "./lookupDomainModel.js";

const file = raw as LookupFormBindingsFile;

export function getLookupFormBindings(): LookupFormBindingsFile {
  return file;
}

export function getLookupBindingsForForm(formId: string): LookupFormDropdownBinding[] {
  return file.bindings.filter((b) => b.formId === formId);
}

export function sortedCommerceLookupValues(rows: CommerceLookupValueDto[]): CommerceLookupValueDto[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Build JsonForm select options from Commerce lookup value rows. */
export function lookupValuesToFieldOptions(
  rows: CommerceLookupValueDto[],
  optionValueKey: LookupFormDropdownBinding["optionValueKey"]
): FieldOptionRow[] {
  const sorted = sortedCommerceLookupValues(rows);
  return sorted.map((r) => ({
    value: optionValueKey === "code" ? r.code : r.id,
    label: `${r.label} · ${r.code}`,
  }));
}

export function validateLookupFormBindings(): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const b of file.bindings) {
    const key = `${b.formId}::${b.fieldId}`;
    if (seen.has(key)) errs.push(`Duplicate binding for ${key}`);
    seen.add(key);
    if (!b.formId?.trim()) errs.push("Binding missing formId.");
    if (!b.fieldId?.trim()) errs.push("Binding missing fieldId.");
    if (!b.lookupTypeId?.trim()) errs.push("Binding missing lookupTypeId.");
  }
  return errs;
}

export type ResolvedLookupSelectPatch = {
  options: FieldOptionRow[];
  label?: string;
  description?: string;
  placeholderOption?: string;
  lookupRows?: CommerceLookupValueDto[];
  optionValueKey?: "id" | "code";
};

/** Load Commerce.Api values for every binding targeting `formId`. */
export async function fetchResolvedLookupFieldOptions(
  formId: string
): Promise<Record<string, ResolvedLookupSelectPatch>> {
  const out: Record<string, ResolvedLookupSelectPatch> = {};
  for (const b of getLookupBindingsForForm(formId)) {
    let rows = await listCommerceLookupValues(b.lookupTypeId);
    if (b.excludeOptionCodes?.length) {
      const excluded = new Set(b.excludeOptionCodes.map((c) => c.trim().toLowerCase()));
      rows = rows.filter((r) => !excluded.has(r.code.trim().toLowerCase()));
    }
    if (b.lookupTypeId === "product_types" || b.lookupTypeId === "application_type") {
      rows = filterProductTypeLookupRowsForGroceries(rows, CATALOG_PRODUCT_TYPE_ID);
    }
    const optionValueKey = (b.optionValueKey ?? "id") as "id" | "code";
    const sorted = sortedCommerceLookupValues(rows);
    const options = sorted.map((r) => ({
      value: optionValueKey === "code" ? r.code : r.id,
      label: `${r.label} · ${r.code}`,
    }));
    out[b.fieldId] = {
      options,
      label: b.label,
      description: b.description,
      placeholderOption: b.placeholderOption,
      lookupRows: sorted,
      optionValueKey,
    };
  }
  return out;
}

/**
 * Clone `form` and turn each keyed field into a `select` with resolved lookup options.
 * Fields not present in `resolved` are left unchanged.
 */
export function applyLookupResolvedOptionsToForm(
  form: FormDefinition,
  resolved: Record<string, ResolvedLookupSelectPatch>
): FormDefinition {
  const clone = structuredClone(form) as FormDefinition;
  for (const [fieldId, patch] of Object.entries(resolved)) {
    const field = clone.fields[fieldId] as FieldDefinition | undefined;
    if (!field) continue;
    field.widget = "select";
    if (patch.label) field.label = patch.label;
    if (patch.description !== undefined) field.description = patch.description;
    const baseProps =
      typeof field.props === "object" && field.props !== null ? { ...field.props } : {};
    field.props = {
      ...baseProps,
      options: patch.options,
      ...(patch.placeholderOption ? { placeholderOption: patch.placeholderOption } : {}),
    };
    field.default = "";
  }
  return clone;
}
