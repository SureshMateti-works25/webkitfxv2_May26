import type { FieldDefinition, FormDefinition, LayoutNode } from "@webkitfxv2/core-engine";
import type { FieldOptionRow } from "@webkitfxv2/react-renderer";
import type { LookupTypeDef } from "./lookupDomainModel.js";

/**
 * Builds a {@link FormDefinition} for JsonForm from registry metadata + parent select options.
 */
export function buildLookupEntryFormDefinition(
  def: LookupTypeDef,
  parentOptions: FieldOptionRow[]
): FormDefinition {
  const fields: Record<string, FieldDefinition> = {
    code: {
      binding: "entry.code",
      widget: "text",
      label: "Code",
      description: "Stable machine key (slug-style).",
      props: { placeholder: "e.g. south", autoComplete: "off" },
      default: "",
      rules: [{ kind: "required" }, { kind: "minLength", value: 1 }, { kind: "maxLength", value: 64 }],
    },
    label: {
      binding: "entry.label",
      widget: "text",
      label: "Label",
      props: { placeholder: "Display name" },
      default: "",
      rules: [{ kind: "required" }, { kind: "minLength", value: 1 }, { kind: "maxLength", value: 120 }],
    },
    sortOrder: {
      binding: "entry.sortOrder",
      widget: "integer",
      label: "Sort order",
      props: { min: 0, step: 1 },
      default: 0,
      rules: [{ kind: "minimum", value: 0 }],
    },
  };

  const layoutChildren: LayoutNode[] = [
    { type: "field", fieldId: "code" },
    { type: "field", fieldId: "label" },
  ];

  if (def.parentLookupId) {
    fields.parentId = {
      binding: "entry.parentId",
      widget: "select",
      label: def.parentFieldLabel?.trim() || "Parent",
      props: {
        options: parentOptions,
        placeholderOption: "Select parent…",
      },
      default: "",
      rules: [{ kind: "required" }],
    };
    layoutChildren.push({ type: "field", fieldId: "parentId" });
  }

  if (def.id === "product_categories") {
    fields.storefrontImageKey = {
      binding: "entry.storefrontImageKey",
      widget: "hidden",
      default: "",
      rules: [{ kind: "maxLength", value: 512 }],
    };
    layoutChildren.push({ type: "field", fieldId: "storefrontImageKey" });
  }

  layoutChildren.push({ type: "field", fieldId: "sortOrder" });

  return {
    id: `lookup-entry-${def.id}`,
    title: `Add ${def.title}`,
    layout: {
      type: "stack",
      axis: "vertical",
      gap: "0.85rem",
      children: layoutChildren,
    },
    fields,
    meta: {
      lookupTypeId: def.id,
      parentLookupId: def.parentLookupId,
    },
  };
}
