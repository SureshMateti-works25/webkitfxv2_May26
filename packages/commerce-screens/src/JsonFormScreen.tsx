import type { ReactNode } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import type { JsonFormScreenProps } from "./types.js";
import { ProseHeader } from "./ProseHeader.js";

/**
 * JsonForm screen template — header copy from JSON + form from core-engine.
 * Submit handlers and action slots are supplied by the host implementation.
 */
export function JsonFormScreen({
  copy,
  form,
  className,
  submitting = false,
  error,
  onSubmit,
  actions,
  children,
}: JsonFormScreenProps) {
  const title = copy.cardTitle ?? copy.title ?? "";
  const lede = copy.lede;

  return (
    <div className={className}>
      {title || lede ? <ProseHeader title={title} lede={lede} /> : null}
      {error ? (
        <p role="alert" style={{ color: "var(--color-danger, #b00020)" }}>
          {error}
        </p>
      ) : null}
      <JsonForm form={form} onSubmit={onSubmit}>
        {children ??
          actions ?? (
            <div className="webkitfx-form-actions">
              <button type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? "…" : (copy.submitLabel ?? "Submit")}
              </button>
            </div>
          )}
      </JsonForm>
    </div>
  );
}

