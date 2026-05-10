import { getAtPath } from "@webkitfxv2/core-engine";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useAuth } from "../auth/AuthContext.js";
import { vendorSignupForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { registerAccount } from "../lib/catalogApi.js";

export function VendorSignupPage() {
  const shell = getShell();
  const copy = shell.screens.vendorSignup;
  const navigate = useNavigate();
  const { signInMember } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
            navigate("/", { state: { notice: "vendor-submitted" } });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Registration failed");
          }
        }}
      >
        <div className="webkitfx-form-actions">
          <button type="submit">{copy.submitLabel}</button>
        </div>
      </JsonForm>
    </div>
  );
}
