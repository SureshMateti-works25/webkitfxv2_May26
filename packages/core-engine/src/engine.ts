import { buildDefaultValues, mergeFormMetaDefaults } from "./defaults.js";
import { fieldEnabled, fieldVisible } from "./conditions.js";
import { collectFieldPlacements, resolveFormLayout } from "./layout.js";
import type {
  EngineContext,
  FieldDefinition,
  FormDefinition,
  TemplateCatalog
} from "./types.js";
import { validateFormFields, type ValidateOptions } from "./validation.js";

const emptyCtx: EngineContext = {
  rules: { formats: {}, customs: {} },
  conditions: { customs: {} }
};

export interface JsonEngineOptions {
  templates?: TemplateCatalog;
  context?: Partial<EngineContext>;
}

function mergeContext(partial: JsonEngineOptions["context"]): EngineContext {
  return {
    rules: {
      formats: { ...emptyCtx.rules.formats, ...partial?.rules?.formats },
      customs: { ...emptyCtx.rules.customs, ...partial?.rules?.customs }
    },
    conditions: {
      customs: { ...emptyCtx.conditions.customs, ...partial?.conditions?.customs }
    }
  };
}

export function createJsonEngine(form: FormDefinition, options: JsonEngineOptions = {}) {
  const resolvedLayout = resolveFormLayout(form, options.templates);
  const placements = collectFieldPlacements(form, resolvedLayout);
  const ctx = mergeContext(options.context);

  function initialValues(): Record<string, unknown> {
    const fromFields = buildDefaultValues(form.fields);
    return mergeFormMetaDefaults(form, fromFields) as Record<string, unknown>;
  }

  async function validate(values: unknown, opts?: ValidateOptions) {
    return validateFormFields(form.fields, values, ctx, opts);
  }

  async function isFieldVisible(fieldId: string, values: unknown) {
    const f = form.fields[fieldId];
    if (!f) return false;
    return fieldVisible(f.visibleWhen, values, ctx.conditions);
  }

  async function isFieldEnabled(fieldId: string, values: unknown) {
    const f = form.fields[fieldId];
    if (!f) return false;
    return fieldEnabled(f.enabledWhen, values, ctx.conditions);
  }

  return {
    form,
    context: ctx,
    resolvedLayout,
    placements,
    initialValues,
    validate,
    isFieldVisible,
    isFieldEnabled,
    getField(fieldId: string): FieldDefinition | undefined {
      return form.fields[fieldId];
    }
  };
}

export type JsonEngine = ReturnType<typeof createJsonEngine>;
