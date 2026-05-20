import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { setInitialPasswordForm } from "../config/forms/index.js";
import { changePassword, formatCommerceApiError } from "../lib/commerceApi.js";

function homeForRole(role: string): string {
  if (role === "vendor") return "/vendor/floor";
  if (role === "admin") return "/admin/vendors";
  return "/";
}

export function SetInitialPasswordPage() {
  const { auth, mustChangePassword, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status !== "signedIn") return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to={homeForRole(auth.role)} replace />;

  return (
    <div className="screen-prose login-card" style={{ maxWidth: "28rem", margin: "2rem auto" }}>
      <h1>Set your password</h1>
      <p>
        Your administrator created this account with a temporary password. Choose a new password to
        continue.
      </p>
      {error ? (
        <p className="login-card__error" role="alert">
          {error}
        </p>
      ) : null}
      <JsonForm
        form={setInitialPasswordForm}
        className="login-card__form"
        onSubmit={async (values) => {
          setError(null);
          const next = String(getAtPath(values, "password.new") ?? "");
          setSubmitting(true);
          try {
            await changePassword(auth.accessToken, null, next);
            clearMustChangePassword();
            navigate(homeForRole(auth.role), { replace: true });
          } catch (e) {
            setError(formatCommerceApiError(e));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="webkitfx-form-actions">
          <button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </JsonForm>
    </div>
  );
}
