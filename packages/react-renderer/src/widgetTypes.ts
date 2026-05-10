import type { FieldDefinition } from "@webkitfxv2/core-engine";
import type { FC } from "react";

/** Renders a single field control; label / errors / hints are handled by `JsonForm`. */
export type WidgetRendererProps = {
  fieldId: string;
  field: FieldDefinition;
  /** Stable id for the primary focus target (or first control). */
  controlId: string;
  /** When set, pass as `aria-labelledby` on the control(s). */
  labelId?: string;
  value: unknown;
  disabled: boolean;
  onChange: (next: unknown) => void;
  onBlur: () => void;
  invalid: boolean;
  /** Hint + error ids — pass as `aria-describedby`. */
  describedBy?: string;
};

export type WidgetRenderer = FC<WidgetRendererProps>;

export type WidgetRegistry = Record<string, WidgetRenderer>;
