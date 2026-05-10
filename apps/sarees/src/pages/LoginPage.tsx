import { getAtPath } from "@webkitfxv2/core-engine";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useAuth } from "../auth/AuthContext.js";
import { loginForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { formatCommerceApiError, loginWithPassword } from "../lib/commerceApi.js";

export function LoginPage() {
  const shell = getShell();
  const copy = shell.screens.login;
  const ent = copy.enterprise;
  const { signInMember, continueGuest } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="login-enterprise-wrap">
      {copy.ribbon ? (
        <div className="login-ribbon" role="presentation">
          {copy.ribbon}
        </div>
      ) : null}
      <div className="login-enterprise">
        <section className="login-enterprise__story" aria-labelledby="login-enterprise-headline">
          <p className="login-enterprise__eyebrow">{ent.eyebrow}</p>
          <h1 className="login-enterprise__headline" id="login-enterprise-headline">
            {ent.headline}
          </h1>
          <p className="login-enterprise__intro">{ent.intro}</p>
          <h2 className="login-enterprise__trends-title">{ent.trendsTitle}</h2>
          <ul className="login-enterprise__trends">
            {ent.trends.map((t) => (
              <li key={t.title}>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </li>
            ))}
          </ul>
          <div className="login-enterprise__metrics">
            {ent.metrics.map((m) => (
              <div key={m.label} className="login-enterprise__metric">
                <span className="login-enterprise__metric-value">{m.value}</span>
                <span className="login-enterprise__metric-label">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="login-enterprise__note">{ent.footerNote}</p>
        </section>

        <aside className="login-enterprise__aside" aria-label="Sign in form">
          <div className="login-card">
            <p className="login-card__brand">{shell.app.name}</p>
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
                  const role = auth.role === "vendor" ? "vendor" : "shopper";
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
                  const dest = role === "vendor" ? "/vendor/products" : "/";
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
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
