import { getAtPath } from "@webkitfxv2/core-engine";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useAuth } from "../auth/AuthContext.js";
import { vendorSignupForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { formatCommerceApiError, registerAccount } from "../lib/commerceApi.js";

export function VendorSignupPage() {
  const shell = getShell();
  const copy = shell.screens.vendorSignup;
  const navigate = useNavigate();
  const { signInMember } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div>
      <header className="screen-prose">
        <h1>{copy.title}</h1>
        <p>{copy.lede}</p>
      </header>
      {error ? (
        <p role="alert" style={{ color: "var(--color-danger, #b00020)" }}>
          {error}
        </p>
      ) : null}
      <JsonForm
        form={vendorSignupForm}
        onSubmit={async (values) => {
          setError(null);
          const v = values as Record<string, unknown>;
          const email = String(getAtPath(v, "credentials.loginName") ?? "").trim();
          const password = String(getAtPath(v, "credentials.password") ?? "");
          setSubmitting(true);
          try {
            const auth = await registerAccount({ email, password, role: "vendor", profile: v });
            const role = "vendor" as const;
            const session = {
              accessToken: auth.accessToken,
              role,
              userId: auth.userId,
              email: auth.email,
              rememberMe: true,
            };
            signInMember({ ...v, session }, { accessToken: auth.accessToken, role });
            navigate("/vendor/products", { state: { notice: "vendor-submitted" } });
          } catch (e) {
            setError(formatCommerceApiError(e));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="webkitfx-form-actions">
          <button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creating account…" : copy.submitLabel}
          </button>
        </div>
      </JsonForm>
    </div>
  );
}
