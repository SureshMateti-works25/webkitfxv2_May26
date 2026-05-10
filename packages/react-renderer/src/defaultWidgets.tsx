import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import type { WidgetRenderer, WidgetRendererProps } from "./widgetTypes.js";
import {
  pickInputProps,
  pickSelectProps,
  pickTextareaProps,
  readBooleanProp,
  readOptions,
  readStringProp
} from "./fieldProps.js";

function baseAria(p: WidgetRendererProps) {
  return {
    "aria-invalid": (p.invalid ? true : undefined) as boolean | undefined,
    "aria-describedby": p.describedBy,
    "aria-labelledby": p.labelId
  };
}

function parseNumber(raw: string): unknown {
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseInteger(raw: string): unknown {
  if (raw === "") return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function strValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

const Text: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="text"
      disabled={p.disabled}
      value={strValue(p.value)}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    />
  );
};

const Password: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="password"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Email: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="email"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Tel: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="tel"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Url: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="url"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Search: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="search"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const NumberWidget: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  const v = p.value;
  const display = typeof v === "number" && Number.isFinite(v) ? String(v) : strValue(v);
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="number"
      disabled={p.disabled}
      value={display}
      onChange={(e) => p.onChange(parseNumber(e.target.value))}
      onBlur={p.onBlur}
    />
  );
};

const Integer: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  const v = p.value;
  const display = typeof v === "number" && Number.isFinite(v) ? String(Math.trunc(v)) : strValue(v);
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="number"
      step={ip.step ?? 1}
      disabled={p.disabled}
      value={display}
      onChange={(e) => p.onChange(parseInteger(e.target.value))}
      onBlur={p.onBlur}
    />
  );
};

const Range: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  const v = typeof p.value === "number" ? p.value : Number(p.value);
  const display = Number.isFinite(v) ? v : 0;
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="range"
      disabled={p.disabled}
      value={display}
      onChange={(e) => p.onChange(parseNumber(e.target.value))}
      onBlur={p.onBlur}
    />
  );
};

const DateWidget: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="date"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value || undefined)}
    onBlur={p.onBlur}
  />
);

const DateTimeLocal: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="datetime-local"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value || undefined)}
    onBlur={p.onBlur}
  />
);

const Time: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="time"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value || undefined)}
    onBlur={p.onBlur}
  />
);

const Month: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="month"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value || undefined)}
    onBlur={p.onBlur}
  />
);

const Week: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="week"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value || undefined)}
    onBlur={p.onBlur}
  />
);

const Color: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    {...baseAria(p)}
    id={p.controlId}
    type="color"
    disabled={p.disabled}
    value={strValue(p.value) || "#000000"}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Hidden: WidgetRenderer = (p) => (
  <input
    {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
    id={p.controlId}
    type="hidden"
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Textarea: WidgetRenderer = (p) => (
  <textarea
    {...(pickTextareaProps(p.field.props) as TextareaHTMLAttributes<HTMLTextAreaElement>)}
    {...baseAria(p)}
    id={p.controlId}
    disabled={p.disabled}
    value={strValue(p.value)}
    onChange={(e) => p.onChange(e.target.value)}
    onBlur={p.onBlur}
  />
);

const Checkbox: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="checkbox"
      disabled={p.disabled}
      checked={Boolean(p.value)}
      onChange={(e) => p.onChange(e.target.checked)}
      onBlur={p.onBlur}
    />
  );
};

const Switch: WidgetRenderer = (p) => (
  <label className="webkitfx-switch">
    <input
      {...(pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>)}
      {...baseAria(p)}
      id={p.controlId}
      type="checkbox"
      role="switch"
      disabled={p.disabled}
      checked={Boolean(p.value)}
      onChange={(e) => p.onChange(e.target.checked)}
      onBlur={p.onBlur}
    />
    {readStringProp(p.field.props, "switchLabel") ? (
      <span>{readStringProp(p.field.props, "switchLabel")}</span>
    ) : null}
  </label>
);

const Select: WidgetRenderer = (p) => {
  const opts = readOptions(p.field.props?.["options"]);
  const sp = pickSelectProps(p.field.props) as SelectHTMLAttributes<HTMLSelectElement>;
  const emptyLabel = readStringProp(p.field.props, "placeholderOption");
  return (
    <select
      {...sp}
      {...baseAria(p)}
      id={p.controlId}
      disabled={p.disabled}
      value={strValue(p.value)}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
    >
      {emptyLabel ? (
        <option value="">{emptyLabel}</option>
      ) : null}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label ?? o.value}
        </option>
      ))}
    </select>
  );
};

const Multiselect: WidgetRenderer = (p) => {
  const opts = readOptions(p.field.props?.["options"]);
  const sp = pickSelectProps(p.field.props) as SelectHTMLAttributes<HTMLSelectElement>;
  const selected = new Set(Array.isArray(p.value) ? p.value.map(String) : []);
  return (
    <select
      {...sp}
      {...baseAria(p)}
      id={p.controlId}
      multiple
      disabled={p.disabled}
      value={Array.from(selected)}
      size={sp.size ?? Math.min(8, Math.max(3, opts.length))}
      onChange={(e) => {
        const next = Array.from(e.target.selectedOptions, (o) => o.value);
        p.onChange(next);
      }}
      onBlur={p.onBlur}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label ?? o.value}
        </option>
      ))}
    </select>
  );
};

const Radio: WidgetRenderer = (p) => {
  const opts = readOptions(p.field.props?.["options"]);
  const name = readStringProp(p.field.props, "radioName") ?? p.fieldId;
  const inline = readBooleanProp(p.field.props, "inline") === true;
  return (
    <div
      className={inline ? "webkitfx-field__control--inline" : undefined}
      role="radiogroup"
      aria-labelledby={p.labelId}
      aria-describedby={p.describedBy}
    >
      {opts.map((o, i) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name}
            id={i === 0 ? p.controlId : `${p.controlId}-${o.value}`}
            disabled={p.disabled}
            value={o.value}
            checked={String(p.value) === o.value}
            aria-invalid={p.invalid}
            onChange={() => p.onChange(o.value)}
            onBlur={p.onBlur}
          />{" "}
          {o.label ?? o.value}
        </label>
      ))}
    </div>
  );
};

const File: WidgetRenderer = (p) => {
  const ip = pickInputProps(p.field.props) as InputHTMLAttributes<HTMLInputElement>;
  const multi = readBooleanProp(p.field.props, "multiple") === true || ip.multiple === true;
  return (
    <input
      {...ip}
      {...baseAria(p)}
      id={p.controlId}
      type="file"
      disabled={p.disabled}
      multiple={multi}
      onChange={(e) => {
        const files = e.target.files;
        if (!files?.length) {
          p.onChange(undefined);
          return;
        }
        if (multi) p.onChange(Array.from(files, (f) => f.name));
        else p.onChange(files[0]?.name);
      }}
      onBlur={p.onBlur}
    />
  );
};

/** Fallback: read-only JSON for unknown `widget` ids. */
const JsonFallback: WidgetRenderer = (p) => (
  <pre
    id={p.controlId}
    {...baseAria(p)}
    style={{ fontSize: 12, overflow: "auto", maxHeight: 120 }}
  >
    {JSON.stringify(p.value ?? null, null, 2)}
  </pre>
);

export const defaultWidgetRegistry: Record<string, WidgetRenderer> = {
  text: Text,
  password: Password,
  email: Email,
  tel: Tel,
  url: Url,
  search: Search,
  number: NumberWidget,
  integer: Integer,
  range: Range,
  date: DateWidget,
  "datetime-local": DateTimeLocal,
  time: Time,
  month: Month,
  week: Week,
  color: Color,
  hidden: Hidden,
  textarea: Textarea,
  checkbox: Checkbox,
  switch: Switch,
  select: Select,
  multiselect: Multiselect,
  radio: Radio,
  file: File,
  json: JsonFallback
};

export const BUILTIN_WIDGET_IDS = Object.freeze(Object.keys(defaultWidgetRegistry));
