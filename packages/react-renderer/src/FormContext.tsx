import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  getAtPath,
  setAtPath,
  validateFieldRules,
  type FieldDefinition,
  type JsonEngine,
  type ValidationIssue
} from "@webkitfxv2/core-engine";
import type { WidgetRegistry } from "./widgetTypes.js";

export type FormRendererContextValue = {
  engine: JsonEngine;
  widgets: WidgetRegistry;
  values: Record<string, unknown>;
  setBinding: (binding: string, next: unknown) => void;
  issuesByBinding: Record<string, ValidationIssue[]>;
  visibleByFieldId: Record<string, boolean>;
  enabledByFieldId: Record<string, boolean>;
  onFieldBlur: (field: FieldDefinition) => void;
  showErrorsForBinding: (binding: string) => boolean;
  validateAll: () => Promise<boolean>;
  submitAttempted: boolean;
  setSubmitAttempted: (v: boolean) => void;
};

const FormRendererContext = createContext<FormRendererContextValue | null>(null);

export function useFormRenderer(): FormRendererContextValue {
  const v = useContext(FormRendererContext);
  if (!v) throw new Error("useFormRenderer must be used under FormRendererProvider");
  return v;
}

export interface FormRendererProviderProps {
  engine: JsonEngine;
  widgets: WidgetRegistry;
  children: ReactNode;
  onValuesChange?: (values: Record<string, unknown>) => void;
}

export function FormRendererProvider({
  engine,
  widgets,
  children,
  onValuesChange
}: FormRendererProviderProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => engine.initialValues());
  const [issuesByBinding, setIssuesByBinding] = useState<Record<string, ValidationIssue[]>>({});
  const [visibleByFieldId, setVisibleByFieldId] = useState<Record<string, boolean>>({});
  const [enabledByFieldId, setEnabledByFieldId] = useState<Record<string, boolean>>({});
  const [touchedBindings, setTouchedBindings] = useState(() => new Set<string>());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vis: Record<string, boolean> = {};
      const en: Record<string, boolean> = {};
      for (const id of Object.keys(engine.form.fields)) {
        vis[id] = await engine.isFieldVisible(id, values);
        en[id] = await engine.isFieldEnabled(id, values);
      }
      if (!cancelled) {
        setVisibleByFieldId(vis);
        setEnabledByFieldId(en);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, values]);

  const setBinding = useCallback(
    (binding: string, next: unknown) => {
      setValues((prev) => {
        const merged = setAtPath(prev, binding, next) as Record<string, unknown>;
        onValuesChange?.(merged);
        return merged;
      });
      setIssuesByBinding((prev) => {
        if (!prev[binding]) return prev;
        const copy = { ...prev };
        delete copy[binding];
        return copy;
      });
    },
    [onValuesChange]
  );

  const onFieldBlur = useCallback(
    (field: FieldDefinition) => {
      setTouchedBindings((s) => {
        const n = new Set(s);
        n.add(field.binding);
        return n;
      });
      void (async () => {
        const v = getAtPath(values, field.binding);
        const issues = await validateFieldRules(
          field.binding,
          v,
          values,
          field.rules,
          engine.context.rules
        );
        setIssuesByBinding((prev) => {
          const copy = { ...prev };
          if (issues.length) copy[field.binding] = issues;
          else delete copy[field.binding];
          return copy;
        });
      })();
    },
    [engine.context.rules, values]
  );

  const showErrorsForBinding = useCallback(
    (binding: string) => submitAttempted || touchedBindings.has(binding),
    [submitAttempted, touchedBindings]
  );

  const validateAll = useCallback(async () => {
    const next = await engine.validate(values);
    setIssuesByBinding(next);
    return Object.keys(next).length === 0;
  }, [engine, values]);

  const ctx = useMemo<FormRendererContextValue>(
    () => ({
      engine,
      widgets,
      values,
      setBinding,
      issuesByBinding,
      visibleByFieldId,
      enabledByFieldId,
      onFieldBlur,
      showErrorsForBinding,
      validateAll,
      submitAttempted,
      setSubmitAttempted
    }),
    [
      engine,
      widgets,
      values,
      setBinding,
      issuesByBinding,
      visibleByFieldId,
      enabledByFieldId,
      onFieldBlur,
      showErrorsForBinding,
      validateAll,
      submitAttempted
    ]
  );

  return <FormRendererContext.Provider value={ctx}>{children}</FormRendererContext.Provider>;
}
