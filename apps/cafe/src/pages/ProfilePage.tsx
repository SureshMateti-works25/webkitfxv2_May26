import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { portalUserProfileForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";
import { fetchAuthMe, formatCommerceApiError } from "../lib/commerceApi.js";

const READONLY_WIDGETS = {
  text: (p: { value: unknown }) => <span>{String(p.value ?? "—")}</span>,
  textarea: (p: { value: unknown }) => <span>{String(p.value ?? "—")}</span>,
};

export function ProfilePage() {
  const { auth, getAccessToken } = useAuth();
  const shell = getShell();
  const copy = shell.screens.accountProfile;
  const [profileSeed, setProfileSeed] = useState<Record<string, unknown>>({
    profile: { fullName: "", phone: "", jobTitle: "", notes: "" },
  });
  const [meta, setMeta] = useState<{ email: string; role: string; permissionRole?: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    const token = getAccessToken();
    if (!token) return;
    void fetchAuthMe(token)
      .then((me) => {
        const p = me.profile ?? {};
        setProfileSeed({
          profile: {
            fullName: String(p.fullName ?? getAtPath(auth.payload, "profile.fullName") ?? ""),
            phone: String(p.phone ?? getAtPath(auth.payload, "profile.phone") ?? ""),
            jobTitle: String(p.jobTitle ?? getAtPath(auth.payload, "profile.jobTitle") ?? ""),
            notes: String(p.notes ?? ""),
          },
        });
        setMeta({
          email: me.email,
          role: me.role,
          permissionRole: me.permissionRole,
        });
      })
      .catch((e) => setError(formatCommerceApiError(e)));
  }, [auth.status, getAccessToken, auth]);

  const readOnlyForm = useMemo(() => {
    const base = portalUserProfileForm;
    const fields = { ...base.fields };
    for (const key of Object.keys(fields)) {
      const f = fields[key];
      if (!f) continue;
      fields[key] = {
        ...f,
        props: { ...(f.props as Record<string, unknown>), readOnly: true, disabled: true },
      };
    }
    return { ...base, fields };
  }, []);

  if (auth.status !== "signedIn") {
    return <Navigate to="/login" replace />;
  }

  const roleLabel =
    meta?.role === "vendor" ? "Vendor / staff" : meta?.role === "admin" ? "Site admin" : "Shopper";

  return (
    <div className="screen-prose profile-page">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="profile-summary">
        <div className="profile-summary__row">
          <dt>Role</dt>
          <dd>
            {roleLabel}
            {meta?.permissionRole ? (
              <>
                {" "}
                (<code>{meta.permissionRole}</code>)
              </>
            ) : null}
          </dd>
        </div>
        <div className="profile-summary__row">
          <dt>Email</dt>
          <dd>{meta?.email ?? "—"}</dd>
        </div>
      </dl>
      <section className="lookup-admin-page__panel" aria-label="Profile details">
        <JsonForm
          form={readOnlyForm}
          className="lookup-admin-page__form"
          seedValues={profileSeed}
          resetKey={meta?.email ?? "profile"}
          widgets={READONLY_WIDGETS}
        />
      </section>
      <p>
        <Link to="/account/change-password">Change password</Link>
      </p>
    </div>
  );
}
