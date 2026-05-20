import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupEntryFormActions } from "../components/LookupEntryFormActions.js";
import { portalUserProfileForm } from "../config/forms/index.js";

const PROFILE_FORM_ID = "portal-user-profile-form";
import { getPortalUsersAdminScreen } from "../config/getPortalUsersAdminScreen.js";
import {
  formatCommerceApiError,
  getAdminPortalUser,
  patchAdminPortalUser,
  patchAdminPortalUserLogin,
  type CommercePortalUserDetail,
} from "../lib/commerceApi.js";

function profileSeed(user: CommercePortalUserDetail | null): Record<string, unknown> {
  if (!user?.profile) return { profile: { fullName: "", phone: "", jobTitle: "", notes: "" } };
  const p = user.profile;
  return {
    profile: {
      fullName: String(p.fullName ?? ""),
      phone: String(p.phone ?? ""),
      jobTitle: String(p.jobTitle ?? ""),
      notes: String(p.notes ?? ""),
    },
  };
}

export function AdminPortalUserProfilePage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const copy = getPortalUsersAdminScreen().copy;
  const location = useLocation();
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();
  const adminUserId =
    auth.status === "signedIn" ? String(getAtPath(auth.payload, "session.userId") ?? "").trim() : "";

  const [user, setUser] = useState<CommercePortalUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mutatingLogin, setMutatingLogin] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);

  const notice =
    (location.state as { notice?: string } | null)?.notice === "user-created"
      ? "Account created. Share the temporary password securely; user must change it on first sign-in."
      : null;

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const row = await getAdminPortalUser(token, userId);
      setUser(row);
      setFormResetKey((k) => k + 1);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (auth.status === "signedIn" && auth.role === "admin") void load();
  }, [auth.status, auth.role, load]);

  if (auth.status !== "signedIn" || auth.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  if (!userId) return <Navigate to="/admin/vendors" replace />;

  const isSelf = user?.id === adminUserId;

  return (
    <div className="lookup-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{String(copy.profileTitle ?? "Edit account")}</h1>
        <p className="lookup-admin-page__lede">{String(copy.profileLede ?? "")}</p>
        {user ? (
          <p className="lookup-admin-page__lede">
            <strong>{user.email}</strong> · portal role <code>{user.role}</code>
            {user.mustChangePassword ? (
              <span className="lookup-admin-page__hint"> · {String(copy.mustChangeBadge ?? "")}</span>
            ) : null}
            {user.loginDisabled ? (
              <span className="lookup-admin-page__hint"> · {String(copy.signInDisabled ?? "")}</span>
            ) : null}
          </p>
        ) : null}
        <p className="lookup-admin-page__lede lookup-admin-page__lede--meta">
          <Link to="/admin/vendors">← Vendors</Link>
          {" · "}
          <Link to={`/admin/portal-users/${encodeURIComponent(userId)}/role-assignments`}>
            Role assignments
          </Link>
        </p>
      </header>

      {notice ? (
        <p className="vendor-workspace-msg" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p>Loading…</p>
      ) : user ? (
        <>
          <section className="lookup-admin-page__panel">
            <h2 className="lookup-admin-page__panel-title">Profile</h2>
            <JsonForm
              id={PROFILE_FORM_ID}
              key={formResetKey}
              form={portalUserProfileForm}
              className="lookup-admin-page__form"
              seedValues={profileSeed(user)}
              resetKey={formResetKey}
              onSubmit={async (values) => {
                if (!token) return;
                setSaving(true);
                setError(null);
                try {
                  const updated = await patchAdminPortalUser(token, userId, {
                    profile: {
                      fullName: String(getAtPath(values, "profile.fullName") ?? "").trim(),
                      phone: String(getAtPath(values, "profile.phone") ?? "").trim(),
                      jobTitle: String(getAtPath(values, "profile.jobTitle") ?? "").trim(),
                      notes: String(getAtPath(values, "profile.notes") ?? "").trim(),
                    },
                  });
                  setUser(updated);
                } catch (e) {
                  setError(formatCommerceApiError(e));
                } finally {
                  setSaving(false);
                }
              }}
            >
              <LookupEntryFormActions
                formId={PROFILE_FORM_ID}
                canSave={!!token}
                saving={saving}
                showSaveAndAddAnother={false}
                onCancel={() => void load()}
              />
            </JsonForm>
          </section>

          <section className="lookup-admin-page__panel">
            <h2 className="lookup-admin-page__panel-title">Sign-in</h2>
            {isSelf ? (
              <p className="lookup-admin-page__hint">You cannot disable your own account here.</p>
            ) : (
              <p>
                {user.loginDisabled ? (
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline"
                    disabled={mutatingLogin}
                    onClick={async () => {
                      if (!token) return;
                      setMutatingLogin(true);
                      try {
                        const updated = await patchAdminPortalUserLogin(token, userId, false);
                        setUser((prev) => (prev ? { ...prev, ...updated } : prev));
                      } catch (e) {
                        setError(formatCommerceApiError(e));
                      } finally {
                        setMutatingLogin(false);
                      }
                    }}
                  >
                    Enable sign-in
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shell-btn shell-btn--ghost"
                    disabled={mutatingLogin}
                    onClick={async () => {
                      if (!token) return;
                      setMutatingLogin(true);
                      try {
                        const updated = await patchAdminPortalUserLogin(token, userId, true);
                        setUser((prev) => (prev ? { ...prev, ...updated } : prev));
                      } catch (e) {
                        setError(formatCommerceApiError(e));
                      } finally {
                        setMutatingLogin(false);
                      }
                    }}
                  >
                    Disable sign-in
                  </button>
                )}
              </p>
            )}
            <div className="lookup-admin-page__form" style={{ marginTop: "1rem" }}>
              <label>
                Reset temporary password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                  placeholder="Min 8 characters"
                />
              </label>
              <button
                type="button"
                className="shell-btn shell-btn--secondary"
                disabled={resetPassword.length < 8 || saving}
                onClick={async () => {
                  if (!token) return;
                  setSaving(true);
                  setError(null);
                  try {
                    const updated = await patchAdminPortalUser(token, userId, {
                      resetTemporaryPassword: resetPassword,
                    });
                    setUser(updated);
                    setResetPassword("");
                  } catch (e) {
                    setError(formatCommerceApiError(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Set temporary password (user must change on next login)
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
