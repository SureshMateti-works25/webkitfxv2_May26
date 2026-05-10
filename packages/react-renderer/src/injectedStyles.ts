import { useEffect } from "react";

const STYLE_ID = "webkitfxv2-react-renderer-defaults";

/**
 * Scoped design tokens + component chrome. Applied on `.webkitfx-json-form.webkitfx-theme`.
 * Add `webkitfx-theme--dark` on the same form (via `className`) for dark mode.
 */
const CSS = `
/* —— Design tokens (light) —— */
.webkitfx-json-form.webkitfx-theme {
  --fx-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --fx-radius: 12px;
  --fx-radius-sm: 8px;
  --fx-radius-xs: 6px;
  --fx-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --fx-shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 10px 20px -5px rgba(15, 23, 42, 0.08);
  --fx-border: 1px solid rgba(148, 163, 184, 0.45);
  --fx-border-subtle: 1px solid rgba(148, 163, 184, 0.28);
  --fx-surface: #ffffff;
  --fx-surface-muted: #f8fafc;
  --fx-surface-elevated: #ffffff;
  --fx-text: #0f172a;
  --fx-text-secondary: #475569;
  --fx-text-muted: #64748b;
  --fx-accent: #4f46e5;
  --fx-accent-soft: rgba(79, 70, 229, 0.12);
  --fx-accent-hover: #4338ca;
  --fx-focus: 0 0 0 3px rgba(79, 70, 229, 0.28);
  --fx-error: #dc2626;
  --fx-error-soft: rgba(254, 226, 226, 0.65);
  --fx-track: #e2e8f0;
  --fx-code-bg: #f1f5f9;
  --fx-code-text: #334155;
}

/* —— Dark theme (opt-in: className includes webkitfx-theme--dark) —— */
.webkitfx-json-form.webkitfx-theme.webkitfx-theme--dark {
  --fx-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
  --fx-shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
  --fx-border: 1px solid rgba(71, 85, 105, 0.65);
  --fx-border-subtle: 1px solid rgba(71, 85, 105, 0.45);
  --fx-surface: rgba(30, 41, 59, 0.72);
  --fx-surface-muted: rgba(15, 23, 42, 0.55);
  --fx-surface-elevated: rgba(51, 65, 85, 0.55);
  --fx-text: #f1f5f9;
  --fx-text-secondary: #cbd5e1;
  --fx-text-muted: #94a3b8;
  --fx-accent: #818cf8;
  --fx-accent-soft: rgba(129, 140, 248, 0.18);
  --fx-accent-hover: #a5b4fc;
  --fx-focus: 0 0 0 3px rgba(129, 140, 248, 0.35);
  --fx-error: #f87171;
  --fx-error-soft: rgba(127, 29, 29, 0.35);
  --fx-track: #334155;
  --fx-code-bg: rgba(15, 23, 42, 0.8);
  --fx-code-text: #e2e8f0;
}

.webkitfx-json-form.webkitfx-theme {
  font-family: var(--fx-font);
  /* 16px base avoids iOS zoom-on-focus for inputs; tighten on large screens only */
  font-size: 16px;
  line-height: 1.5;
  color: var(--fx-text);
  width: 100%;
  max-width: min(52rem, 100%);
  min-width: 0;
  margin-inline: auto;
  letter-spacing: -0.01em;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overflow-x: clip;
}

@media (min-width: 768px) {
  .webkitfx-json-form.webkitfx-theme {
    font-size: 15px;
  }
}

/* Layout — mobile-first: single column grids; horizontal stacks become vertical */
.webkitfx-stack {
  display: flex;
  gap: var(--webkitfx-gap, 1rem);
  min-width: 0;
}
.webkitfx-stack[data-axis="horizontal"] {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
}
@media (max-width: 639.98px) {
  .webkitfx-json-form .webkitfx-stack[data-axis="horizontal"] {
    flex-direction: column;
    align-items: stretch;
  }
}
.webkitfx-stack[data-axis="vertical"] {
  flex-direction: column;
}
.webkitfx-grid {
  display: grid;
  gap: var(--webkitfx-gap, 1rem);
  min-width: 0;
}
@media (max-width: 639.98px) {
  .webkitfx-json-form .webkitfx-grid {
    grid-template-columns: 1fr !important;
  }
}

/* Region cards */
.webkitfx-region {
  border: 0;
  margin: 0 0 1rem;
  padding: 1rem 1rem;
  background: var(--fx-surface-elevated);
  border-radius: var(--fx-radius);
  border: var(--fx-border-subtle);
  box-shadow: var(--fx-shadow-sm);
  backdrop-filter: blur(8px);
  min-width: 0;
}
@media (min-width: 640px) {
  .webkitfx-region {
    margin-bottom: 1.25rem;
    padding: 1.25rem 1.35rem;
  }
}
.webkitfx-theme--dark .webkitfx-region {
  backdrop-filter: blur(12px);
}
.webkitfx-region[data-name]::before {
  content: attr(data-name);
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--fx-text-muted);
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: var(--fx-border-subtle);
}

/* Fields */
.webkitfx-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
  min-width: 0;
}

/* Checkbox: FieldBlock renders label above control by default — place box and caption on one row */
.webkitfx-field[data-widget="checkbox"] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 0.55rem;
  row-gap: 0.35rem;
}
.webkitfx-field[data-widget="checkbox"] .webkitfx-field__label {
  grid-column: 2;
  grid-row: 1;
  margin: 0;
}
.webkitfx-field[data-widget="checkbox"] .webkitfx-field__hint {
  grid-column: 1 / -1;
  grid-row: 2;
}
.webkitfx-field[data-widget="checkbox"] .webkitfx-field__control {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
}
.webkitfx-field[data-widget="checkbox"] .webkitfx-field__errors {
  grid-column: 1 / -1;
}

.webkitfx-field__control {
  min-width: 0;
}
.webkitfx-field__label {
  font-weight: 600;
  font-size: 13px;
  color: var(--fx-text);
}
.webkitfx-field__hint {
  font-size: 13px;
  color: var(--fx-text-muted);
  margin: 0;
  line-height: 1.45;
}
.webkitfx-field__errors {
  margin: 0.15rem 0 0;
  padding: 0.5rem 0.65rem;
  list-style: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--fx-error);
  background: var(--fx-error-soft);
  border-radius: var(--fx-radius-xs);
  border: 1px solid rgba(220, 38, 38, 0.2);
}
.webkitfx-theme--dark .webkitfx-field__errors {
  border-color: rgba(248, 113, 113, 0.25);
}
.webkitfx-field__errors li + li {
  margin-top: 0.2rem;
}

/* Text-like controls */
.webkitfx-field__control input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="hidden"]),
.webkitfx-field__control textarea,
.webkitfx-field__control select {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.8rem;
  min-height: 2.75rem;
  font: inherit;
  font-size: 1rem;
  color: var(--fx-text);
  background: var(--fx-surface-muted);
  border: var(--fx-border);
  border-radius: var(--fx-radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.webkitfx-field__control textarea {
  min-height: 5.5rem;
  resize: vertical;
}
.webkitfx-field__control select {
  cursor: pointer;
  appearance: none;
  background-color: var(--fx-surface-muted);
  background-image: linear-gradient(45deg, transparent 50%, var(--fx-text-muted) 50%),
    linear-gradient(135deg, var(--fx-text-muted) 50%, transparent 50%);
  background-position: calc(100% - 1.1rem) 55%, calc(100% - 0.75rem) 55%;
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 2.25rem;
}
.webkitfx-field__control select[multiple] {
  background-image: none;
  padding-right: 0.75rem;
  min-height: 6.5rem;
}
@media (min-width: 640px) {
  .webkitfx-field__control select[multiple] {
    min-height: 8rem;
  }
}
.webkitfx-field__control input:hover,
.webkitfx-field__control textarea:hover,
.webkitfx-field__control select:hover {
  border-color: rgba(79, 70, 229, 0.35);
}
.webkitfx-field__control input:focus-visible,
.webkitfx-field__control textarea:focus-visible,
.webkitfx-field__control select:focus-visible {
  outline: none;
  border-color: var(--fx-accent);
  box-shadow: var(--fx-focus);
  background: var(--fx-surface);
}
.webkitfx-field__control input[aria-invalid="true"],
.webkitfx-field__control textarea[aria-invalid="true"],
.webkitfx-field__control select[aria-invalid="true"] {
  border-color: var(--fx-error);
  background: var(--fx-error-soft);
}
.webkitfx-field__control input:disabled,
.webkitfx-field__control textarea:disabled,
.webkitfx-field__control select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Range */
.webkitfx-field__control input[type="range"] {
  width: 100%;
  max-width: 100%;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--fx-track);
  border: none;
  accent-color: var(--fx-accent);
  cursor: pointer;
}
@media (pointer: coarse) {
  .webkitfx-field__control input[type="range"] {
    height: 0.65rem;
  }
}
.webkitfx-field__control input[type="range"]:focus-visible {
  outline: none;
  box-shadow: var(--fx-focus);
}

/* Color */
.webkitfx-field__control input[type="color"] {
  width: 3.75rem;
  height: 2.5rem;
  padding: 3px;
  border: var(--fx-border);
  border-radius: var(--fx-radius-sm);
  background: var(--fx-surface-muted);
  cursor: pointer;
}
.webkitfx-field__control input[type="color"]:focus-visible {
  outline: none;
  box-shadow: var(--fx-focus);
}

/* File */
.webkitfx-field__control input[type="file"] {
  width: 100%;
  max-width: 100%;
  font-size: 1rem;
  color: var(--fx-text-secondary);
}

/* Checkbox & radio — ≥20px tap target on coarse pointers */
.webkitfx-field__control input[type="checkbox"]:not([role="switch"]),
.webkitfx-field__control input[type="radio"] {
  width: 1.25rem;
  height: 1.25rem;
  min-width: 1.25rem;
  min-height: 1.25rem;
  accent-color: var(--fx-accent);
  cursor: pointer;
}
@media (pointer: coarse) {
  .webkitfx-field__control input[type="checkbox"]:not([role="switch"]),
  .webkitfx-field__control input[type="radio"] {
    width: 1.35rem;
    height: 1.35rem;
    min-width: 1.35rem;
    min-height: 1.35rem;
  }
}
.webkitfx-field__control input[type="radio"]:disabled,
.webkitfx-field__control input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.webkitfx-field__control--inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1.25rem;
  align-items: center;
}
.webkitfx-field__control--inline label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding-block: 0.15rem;
  font-size: 0.9375rem;
  color: var(--fx-text-secondary);
  cursor: pointer;
}
@media (max-width: 639.98px) {
  .webkitfx-field__control--inline {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* Switch */
.webkitfx-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.75rem;
  padding-block: 0.2rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.9375rem;
  color: var(--fx-text-secondary);
}
.webkitfx-switch input {
  width: 2.75rem;
  height: 1.45rem;
  appearance: none;
  background: var(--fx-track);
  border-radius: 999px;
  position: relative;
  transition: background 0.2s ease, box-shadow 0.15s ease;
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
}
.webkitfx-switch input::before {
  content: "";
  position: absolute;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--fx-surface);
  top: 50%;
  left: 0.2rem;
  transform: translateY(-50%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: var(--fx-shadow-sm);
}
.webkitfx-switch input:checked {
  background: linear-gradient(135deg, var(--fx-accent) 0%, var(--fx-accent-hover) 100%);
  border-color: transparent;
}
.webkitfx-switch input:checked::before {
  transform: translate(1.15rem, -50%);
}
.webkitfx-switch input:focus-visible {
  outline: none;
  box-shadow: var(--fx-focus);
}
.webkitfx-switch input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* JSON debug readout */
.webkitfx-field__control pre {
  margin: 0;
  padding: 0.65rem 0.75rem;
  font-size: max(12px, 0.8125rem);
  line-height: 1.4;
  border-radius: var(--fx-radius-sm);
  border: var(--fx-border);
  background: var(--fx-code-bg);
  color: var(--fx-code-text);
  overflow-x: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
  max-width: 100%;
}

/* Orphan section */
.webkitfx-orphan-fields {
  margin-top: 1.5rem;
  padding: 1.1rem 1.25rem;
  border-radius: var(--fx-radius-sm);
  border: 1px dashed rgba(100, 116, 139, 0.45);
  background: var(--fx-accent-soft);
}
.webkitfx-orphan-fields__title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fx-text-muted);
  margin: 0 0 0.65rem;
}

/* Form actions (wrap submit row with class webkitfx-form-actions) */
.webkitfx-form-actions {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: var(--fx-border-subtle);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: stretch;
  flex-direction: column;
}
@media (min-width: 480px) {
  .webkitfx-form-actions {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    flex-direction: row;
    align-items: center;
  }
}

.webkitfx-json-form.webkitfx-theme button[type="submit"] {
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 1.25rem;
  border: none;
  border-radius: var(--fx-radius-sm);
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
  background: linear-gradient(165deg, var(--fx-accent) 0%, var(--fx-accent-hover) 100%);
  box-shadow: var(--fx-shadow-sm), 0 2px 0 rgba(0, 0, 0, 0.06) inset;
  transition: transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
@media (min-width: 480px) {
  .webkitfx-json-form.webkitfx-theme button[type="submit"] {
    width: auto;
    min-width: 7.5rem;
    font-size: 0.9375rem;
  }
}
.webkitfx-json-form.webkitfx-theme button[type="submit"]:hover {
  filter: brightness(1.05);
  box-shadow: var(--fx-shadow-md);
}
.webkitfx-json-form.webkitfx-theme button[type="submit"]:active {
  transform: translateY(1px);
}
.webkitfx-json-form.webkitfx-theme button[type="submit"]:focus-visible {
  outline: none;
  box-shadow: var(--fx-focus), var(--fx-shadow-sm);
}
.webkitfx-json-form.webkitfx-theme button[type="submit"]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
`;

export function useInjectedFormStylesOnce(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = CSS;
      return;
    }
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}
