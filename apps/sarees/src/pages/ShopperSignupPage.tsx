import { getAtPath } from "@webkitfxv2/core-engine";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useAuth } from "../auth/AuthContext.js";
import { shopperSignupForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { registerAccount } from "../lib/catalogApi.js";

export function ShopperSignupPage() {
  const shell = getShell();
  const copy = shell.screens.shopperSignup;
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
        form={shopperSignupForm}
        onSubmit={async (values) => {
          setError(null);
          const v = values as Record<string, unknown>;
          const email = String(
            getAtPath(v, "profile.email") || getAtPath(v, "credentials.loginName") || ""
          ).trim();
          const password = String(getAtPath(v, "credentials.password") ?? "");
          try {
            const auth = await registerAccount({ email, password, role: "shopper", profile: v });
            const role = auth.role === "vendor" ? "vendor" : "shopper";
            const session = {
              accessToken: auth.accessToken,
              role,
              userId: auth.userId,
              email: auth.email,
              rememberMe: true,
            };
            signInMember({ ...v, session }, { accessToken: auth.accessToken, role });
            navigate("/", { state: { notice: "shopper-saved" } });
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
