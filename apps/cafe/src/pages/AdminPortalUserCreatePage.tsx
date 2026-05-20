import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupEntryFormActions } from "../components/LookupEntryFormActions.js";
import { adminCreatePortalUserForm } from "../config/forms/index.js";
import { getPortalUsersAdminScreen } from "../config/getPortalUsersAdminScreen.js";
import {
  createAdminPortalUser,
  fetchTenantRoles,
  formatCommerceApiError,
  seedTenantRoleDefaults,
} from "../lib/commerceApi.js";

const CREATE_FORM_ID = "admin-create-portal-user-form";

export function AdminPortalUserCreatePage() {
  const copy = getPortalUsersAdminScreen().copy;
  const { auth, getAccessToken } = useAuth();
  const navigate = useNavigate();
  const token = getAccessToken();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    void fetchTenantRoles(token).then((data) => {
      const opts = [...data.systemRoles, ...data.customRoles].map((r) => ({
        value: r.roleKey,
        label: `${r.displayName} (${r.roleKey})`,
      }));
      setRoleOptions(opts);
    });
  }, [token]);

  const form = useMemo(() => {
    const base = adminCreatePortalUserForm;
    const field = base.fields.permissionRoleKey;
    if (!field) return base;
    return {
      ...base,
      fields: {
        ...base.fields,
        permissionRoleKey: {
          ...field,
          props: { ...(field.props as Record<string, unknown>), options: roleOptions },
        },
      },
    };
  }, [roleOptions]);

  if (auth.status !== "signedIn" || auth.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  const onSeedRoles = async () => {
    if (!token) return;
    setSeeding(true);
    setError(null);
    try {
      await seedTenantRoleDefaults(token);
      const data = await fetchTenantRoles(token);
      setRoleOptions(
        [...data.systemRoles, ...data.customRoles].map((r) => ({
          value: r.roleKey,
          label: `${r.displayName} (${r.roleKey})`,
        }))
      );
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="lookup-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{String(copy.createTitle ?? "Create account")}</h1>
        <p className="lookup-admin-page__lede">{String(copy.createLede ?? "")}</p>
        <p className="lookup-admin-page__lede lookup-admin-page__lede--meta">
          <Link to="/admin/vendors">← Back to vendors</Link>
          {" · "}
          <Link to="/admin/roles">Roles</Link>
          {roleOptions.length === 0 ? (
            <>
              {" · "}
              <button type="button" className="cart-page__linkish" disabled={seeding} onClick={() => void onSeedRoles()}>
                {seeding ? "Seeding…" : "Seed café roles"}
              </button>
            </>
          ) : null}
        </p>
      </header>

      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="lookup-admin-page__panel">
        <JsonForm
          id={CREATE_FORM_ID}
          form={form}
          className="lookup-admin-page__form"
          onSubmit={async (values) => {
            if (!token) return;
            const email = String(getAtPath(values, "account.email") ?? "").trim();
            const temporaryPassword = String(getAtPath(values, "account.temporaryPassword") ?? "");
            const portalRole = String(getAtPath(values, "account.portalRole") ?? "vendor");
            const roleKey = String(getAtPath(values, "assignment.roleKey") ?? "").trim();
            const portalBaseRole = String(getAtPath(values, "assignment.portalBaseRole") ?? "vendor").trim();
            const profile = {
              fullName: String(getAtPath(values, "profile.fullName") ?? "").trim() || undefined,
              phone: String(getAtPath(values, "profile.phone") ?? "").trim() || undefined,
              jobTitle: String(getAtPath(values, "profile.jobTitle") ?? "").trim() || undefined,
            };
            setSaving(true);
            setError(null);
            try {
              const created = await createAdminPortalUser(token, {
                email,
                temporaryPassword,
                portalRole: portalRole === "shopper" ? "shopper" : "vendor",
                profile,
                primaryAssignment:
                  roleKey.length > 0
                    ? {
                        roleKey,
                        portalBaseRole: portalBaseRole === "shopper" ? "shopper" : "vendor",
                      }
                    : undefined,
              });
              navigate(`/admin/portal-users/${encodeURIComponent(created.id)}`, {
                state: { notice: "user-created" },
              });
            } catch (e) {
              setError(formatCommerceApiError(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          <LookupEntryFormActions
            formId={CREATE_FORM_ID}
            canSave={!!token}
            saving={saving}
            showSaveAndAddAnother={false}
            onCancel={() => navigate("/admin/vendors")}
          />
        </JsonForm>
      </section>
    </div>
  );
}
