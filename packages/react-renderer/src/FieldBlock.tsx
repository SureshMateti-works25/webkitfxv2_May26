import { getAtPath } from "@webkitfxv2/core-engine";
import { useMemo } from "react";
import {
  readBooleanProp,
  readClassName,
  readStyle
} from "./fieldProps.js";
import { useFormRenderer } from "./FormContext.js";

export function FieldBlock({ fieldId }: { fieldId: string }) {
  const {
    engine,
    widgets,
    values,
    setBinding,
    issuesByBinding,
    visibleByFieldId,
    enabledByFieldId,
    onFieldBlur,
    showErrorsForBinding
  } = useFormRenderer();

  const field = engine.form.fields[fieldId];
  const visible = visibleByFieldId[fieldId] !== false;
  const enabled = enabledByFieldId[fieldId] !== false;

  const hintId = `webkitfx-hint-${fieldId}`;
  const errId = `webkitfx-err-${fieldId}`;
  const controlId = `webkitfx-ctl-${fieldId}`;
  const labelId = field?.label ? `webkitfx-lbl-${fieldId}` : undefined;

  const describedBy = useMemo(() => {
    const parts: string[] = [];
    if (field?.description) parts.push(hintId);
    const issues = field ? issuesByBinding[field.binding] : undefined;
    if (issues?.length && field && showErrorsForBinding(field.binding)) parts.push(errId);
    return parts.length ? parts.join(" ") : undefined;
  }, [field, issuesByBinding, showErrorsForBinding, hintId, errId]);

  if (!field) return null;
  if (!visible) return null;

  const W = widgets[field.widget] ?? widgets["text"]!;
  const value = getAtPath(values, field.binding);
  const propsDisabled = readBooleanProp(field.props, "disabled") === true;
  const disabled = !enabled || propsDisabled;
  const issues = issuesByBinding[field.binding];
  const showErr = Boolean(issues?.length && showErrorsForBinding(field.binding));
  const invalid = showErr;
  const extraClass = readClassName(field.props);
  const extraStyle = readStyle(field.props);

  return (
    <div
      className={["webkitfx-field", extraClass].filter(Boolean).join(" ")}
      style={extraStyle}
      data-field-id={fieldId}
      data-widget={field.widget}
    >
      {field.label ? (
        <div className="webkitfx-field__label" id={labelId}>
          {field.label}
        </div>
      ) : null}
      {field.description ? (
        <p className="webkitfx-field__hint" id={hintId}>
          {field.description}
        </p>
      ) : null}
      <div className="webkitfx-field__control">
        <W
          fieldId={fieldId}
          field={field}
          controlId={controlId}
          labelId={labelId}
          value={value}
          disabled={disabled}
          onChange={(next) => setBinding(field.binding, next)}
          onBlur={() => onFieldBlur(field)}
          invalid={invalid}
          describedBy={describedBy}
        />
      </div>
      {showErr ? (
        <ul className="webkitfx-field__errors" id={errId} role="alert">
          {issues!.map((iss, i) => (
            <li key={`${iss.ruleKind}-${i}`}>{iss.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
