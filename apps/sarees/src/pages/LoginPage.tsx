import { getAtPath } from "@webkitfxv2/core-engine";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useAuth } from "../auth/AuthContext.js";
import { loginForm } from "../config/forms/index.js";
import { formatCommerceApiError, loginWithPassword } from "../lib/commerceApi.js";
import { useTenantChrome } from "../lib/useTenantChrome.js";

export function LoginPage() {
  const { shell, displayName, applicationTypeLabel } = useTenantChrome();
  const copy = shell.screens.login;
  const welcome = copy.welcome;
  const { signInMember, continueGuest } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="login-enterprise-wrap">
      <div className="login-enterprise">
        <aside className="login-enterprise__aside" aria-label="Sign in form">
          <div className="login-card">
            <p className="login-card__brand">{displayName}</p>
            <p className="login-card__app-type">{applicationTypeLabel}</p>
            <h2>{copy.cardTitle}</h2>
            <p className="login-card__lede">{copy.lede}</p>
            {error ? (
              <p className="login-card__error" role="alert" style={{ color: "var(--color-danger, #b00020)" }}>
                {error}
              </p>
            ) : null}
            <JsonForm
              form={loginForm}
              className="login-card__form"
              onSubmit={async (values) => {
                setError(null);
                const v = values as Record<string, unknown>;
                const email = String(getAtPath(v, "credentials.loginName") ?? "").trim();
                const password = String(getAtPath(v, "credentials.password") ?? "");
                setSubmitting(true);
                try {
                  const auth = await loginWithPassword(email, password);
                  const role =
                    auth.role === "vendor" || auth.role === "admin"
                      ? auth.role
                      : "shopper";
                  const prevSession =
                    typeof v.session === "object" && v.session !== null && !Array.isArray(v.session)
                      ? (v.session as Record<string, unknown>)
                      : {};
                  const session = {
                    ...prevSession,
                    accessToken: auth.accessToken,
                    role,
                    userId: auth.userId,
                    email: auth.email,
                  };
                  signInMember({ ...v, session }, { accessToken: auth.accessToken, role });
                  const dest =
                    role === "vendor" ? "/vendor/products" : role === "admin" ? "/admin/vendors" : "/";
                  navigate(dest, { state: { notice: "member-signed-in" } });
                } catch (e) {
                  setError(formatCommerceApiError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <div className="webkitfx-form-actions" style={{ flexDirection: "column", gap: "0.65rem" }}>
                <button type="submit" disabled={submitting} aria-busy={submitting}>
                  {submitting ? "Signing in…" : copy.submitMember}
                </button>
                <button
                  type="button"
                  className="auth-guest-btn"
                  onClick={() => {
                    continueGuest();
                    navigate("/");
                  }}
                >
                  {copy.guestCta}
                </button>
              </div>
            </JsonForm>
            <div className="login-card__links">
              <p>New here?</p>
              <ul>
                {copy.signupLinks.map((l) => (
                  <li key={l.path}>
                    <Link to={l.path}>{l.label}</Link>
                  </li>
                ))}
                <li>
                  <Link to="/forgot-password">Forgot password?</Link>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="login-enterprise__welcome" aria-labelledby="login-welcome-headline">
          <p className="login-enterprise__eyebrow">{welcome.eyebrow}</p>
          <h1 className="login-enterprise__headline" id="login-welcome-headline">
            {welcome.headline}
          </h1>
          <p className="login-enterprise__intro">{welcome.intro}</p>
          <h2 className="login-enterprise__highlights-title">{welcome.highlightsTitle}</h2>
          <ul className="login-enterprise__highlights">
            {welcome.highlights.map((h) => (
              <li key={h.title}>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
