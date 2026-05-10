import {
  createJsonEngine,
  type EngineContext,
  type FormDefinition,
  type TemplateCatalog
} from "@webkitfxv2/core-engine";
import { useMemo, type FormEvent, type ReactNode } from "react";
import { defaultWidgetRegistry } from "./defaultWidgets.js";
import { FieldBlock } from "./FieldBlock.js";
import { FormRendererProvider, useFormRenderer } from "./FormContext.js";
import { fieldIdsInResolvedLayout } from "./layoutFieldIds.js";
import { LayoutRenderer } from "./LayoutRenderer.js";
import { useInjectedFormStylesOnce } from "./injectedStyles.js";
import type { WidgetRegistry } from "./widgetTypes.js";

export interface JsonFormProps {
  form: FormDefinition;
  templates?: TemplateCatalog;
  context?: Partial<EngineContext>;
  /** Overrides or extends built-in `widget` renderers. */
  widgets?: Partial<WidgetRegistry>;
  id?: string;
  className?: string;
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  onValuesChange?: (values: Record<string, unknown>) => void;
  /** Rendered inside the `<form>` after fields (e.g. `<button type="submit">`). */
  children?: ReactNode;
}

function mergeWidgets(overrides?: Partial<WidgetRegistry>): WidgetRegistry {
  const out: WidgetRegistry = { ...defaultWidgetRegistry };
  if (!overrides) return out;
  for (const k of Object.keys(overrides)) {
    const w = overrides[k];
    if (w) out[k] = w;
  }
  return out;
}

export function JsonForm({
  form,
  templates,
  context,
  widgets,
  id,
  className,
  onSubmit,
  onValuesChange,
  children
}: JsonFormProps) {
  useInjectedFormStylesOnce();
  const engine = useMemo(
    () => createJsonEngine(form, { templates, context }),
    [form, templates, context]
  );
  const mergedWidgets = useMemo(() => mergeWidgets(widgets), [widgets]);

  return (
    <FormRendererProvider engine={engine} widgets={mergedWidgets} onValuesChange={onValuesChange}>
      <JsonFormSurface id={id} className={className} onSubmit={onSubmit}>
        {children}
      </JsonFormSurface>
    </FormRendererProvider>
  );
}

function JsonFormSurface({
  id,
  className,
  onSubmit,
  children
}: Pick<JsonFormProps, "id" | "className" | "onSubmit" | "children">) {
  const { values, validateAll, setSubmitAttempted, engine } = useFormRenderer();

  const layoutIds = useMemo(
    () => fieldIdsInResolvedLayout(engine.resolvedLayout),
    [engine.resolvedLayout]
  );

  const orphans = useMemo(
    () => engine.placements.filter((p) => !layoutIds.has(p.fieldId)),
    [engine.placements, layoutIds]
  );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const ok = await validateAll();
    if (ok) await onSubmit?.(values);
  };

  return (
    <form
      id={id}
      className={["webkitfx-json-form", "webkitfx-theme", className].filter(Boolean).join(" ")}
      onSubmit={submit}
      noValidate
    >
      <LayoutRenderer node={engine.resolvedLayout} />
      {orphans.length > 0 ? (
        <section className="webkitfx-orphan-fields">
          <p className="webkitfx-orphan-fields__title">Fields not placed in layout</p>
          <div className="webkitfx-stack" data-axis="vertical">
            {orphans.map((o) => (
              <FieldBlock key={o.fieldId} fieldId={o.fieldId} />
            ))}
          </div>
        </section>
      ) : null}
      {children}
    </form>
  );
}
