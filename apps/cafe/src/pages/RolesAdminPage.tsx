import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupEntryFormActions } from "../components/LookupEntryFormActions.js";
import { RolePermissionPicker } from "../components/RolePermissionPicker.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { getForm } from "../config/forms/index.js";
import { getRolesAdminWorkspace } from "../config/getRolesAdminWorkspace.js";
import {
  createTenantRole,
  deleteTenantRole,
  fetchTenantRoles,
  formatCommerceApiError,
  seedTenantRoleDefaults,
  updateTenantRole,
  type CommerceTenantRoleRow,
} from "../lib/commerceApi.js";

const ROLE_FORM_ID = "tenant-role-form";

function roleFormSeed(row: CommerceTenantRoleRow | null): Record<string, unknown> {
  if (!row) {
    return { role: { roleKey: "", displayName: "", description: "" } };
  }
  return {
    role: {
      roleKey: row.roleKey,
      displayName: row.displayName,
      description: row.description ?? "",
    },
  };
}

function readRoleMeta(values: Record<string, unknown>) {
  const roleKey = String(getAtPath(values, "role.roleKey") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(getAtPath(values, "role.displayName") ?? "").trim();
  const description = String(getAtPath(values, "role.description") ?? "").trim();
  if (!roleKey || !displayName) throw new Error("Role key and display name are required.");
  return { roleKey, displayName, description: description || null };
}

export function RolesAdminPage() {
  const workspace = getRolesAdminWorkspace();
  const copy = getScreenConfig(workspace.screenId);
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();
  const isAdmin = auth.status === "signedIn" && auth.role === "admin";

  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof fetchTenantRoles>>["permissionCatalog"]>([]);
  const [systemRoles, setSystemRoles] = useState<CommerceTenantRoleRow[]>([]);
  const [customRoles, setCustomRoles] = useState<CommerceTenantRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [formResetKey, setFormResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const roleFormBase = getForm(workspace.formId);
  const editingRow = editingId ? customRoles.find((r) => r.id === editingId) : null;
  const roleForm = useMemo(() => {
    if (!editingId) return roleFormBase;
    const roleKeyField = roleFormBase.fields.roleKey;
    if (!roleKeyField) return roleFormBase;
    return {
      ...roleFormBase,
      fields: {
        ...roleFormBase.fields,
        roleKey: {
          ...roleKeyField,
          props: { ...(roleKeyField.props as Record<string, unknown>), readOnly: true, disabled: true },
        },
      },
    };
  }, [roleFormBase, editingId]);

  const load = useCallback(async () => {
    const t = getAccessToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantRoles(t);
      setCatalog(data.permissionCatalog);
      setSystemRoles(data.systemRoles);
      setCustomRoles(data.customRoles);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (
      auth.status === "signedIn" &&
      workspace.allowedRoles.includes(auth.role)
    ) {
      void load();
    }
  }, [auth.status, auth.role, load, workspace.allowedRoles]);

  useEffect(() => {
    if (editingRow) {
      setSelectedPermissions([...editingRow.permissions]);
    } else if (showAdd) {
      setSelectedPermissions([]);
    }
  }, [editingRow, showAdd, editingId]);

  const formSeed = useMemo(() => roleFormSeed(editingRow ?? null), [editingRow]);

  if (
    auth.status !== "signedIn" ||
    !workspace.allowedRoles.includes(auth.role)
  ) {
    return <Navigate to="/login" replace />;
  }

  if (!token) {
    return (
      <div className="lookup-admin-page">
        <p className="lookup-admin-page__form-error" role="alert">
          No access token. Sign in again.
        </p>
      </div>
    );
  }

  const startAdd = () => {
    setEditingId(null);
    setShowAdd(true);
    setFormResetKey((k) => k + 1);
    setSelectedPermissions([]);
  };

  const startEdit = (row: CommerceTenantRoleRow) => {
    setShowAdd(false);
    setEditingId(row.id);
    setFormResetKey((k) => k + 1);
    setSelectedPermissions([...row.permissions]);
  };

  const cancelForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setSelectedPermissions([]);
  };

  const onSave = async (values: Record<string, unknown>) => {
    const t = getAccessToken();
    if (!t) return;
    if (selectedPermissions.length === 0) {
      setError("Select at least one permission.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const meta = readRoleMeta(values);
      if (editingId) {
        await updateTenantRole(t, editingId, {
          displayName: meta.displayName,
          description: meta.description,
          permissions: selectedPermissions,
        });
      } else {
        await createTenantRole(t, {
          roleKey: meta.roleKey,
          displayName: meta.displayName,
          description: meta.description,
          permissions: selectedPermissions,
        });
      }
      cancelForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: CommerceTenantRoleRow) => {
    const t = getAccessToken();
    if (!t) return;
    if (row.isBuiltIn && !isAdmin) {
      setError("Built-in app roles can only be removed by an administrator.");
      return;
    }
    if (!window.confirm(`Delete role “${row.displayName}”?`)) return;
    setError(null);
    try {
      await deleteTenantRole(t, row.id);
      if (editingId === row.id) cancelForm();
      await load();
    } catch (e) {
      setError(formatCommerceApiError(e));
    }
  };

  const onSeedDefaults = async () => {
    const t = getAccessToken();
    if (!t || workspace.defaultRoles.length === 0) return;
    setSeeding(true);
    setError(null);
    try {
      await seedTenantRoleDefaults(t, workspace.defaultRoles);
      await load();
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setSeeding(false);
    }
  };

  const showForm = showAdd || editingId != null;

  return (
    <div className="lookup-admin-page roles-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{String(copy.title ?? "Roles")}</h1>
        <p className="lookup-admin-page__lede">{String(copy.body ?? "")}</p>
        <p className="lookup-admin-page__lede lookup-admin-page__lede--meta">
          Workspace: <code>config/workspaces/roles-admin.json</code>
        </p>
      </header>

      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p aria-live="polite">Loading roles…</p> : null}

      <section className="roles-admin-page__section">
        <h2 className="roles-admin-page__section-title">
          {String(copy.systemSectionTitle ?? "Built-in roles")}
        </h2>
        <ul className="roles-admin-page__role-list">
          {systemRoles.map((row) => (
            <li key={row.id} className="roles-admin-page__role-card roles-admin-page__role-card--system">
              <div className="roles-admin-page__role-head">
                <strong>{row.displayName}</strong>
                <code>{row.roleKey}</code>
              </div>
              <p className="roles-admin-page__perm-summary">
                {row.permissions.length} permission{row.permissions.length === 1 ? "" : "s"}
              </p>
              <details className="roles-admin-page__perm-details">
                <summary>View permissions</summary>
                <ul>
                  {row.permissions.map((p) => (
                    <li key={p}>
                      <code>{p}</code>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="roles-admin-page__section">
        <div className="roles-admin-page__toolbar">
          <h2 className="roles-admin-page__section-title">
            {String(copy.customSectionTitle ?? "Custom roles")}
          </h2>
          <div className="roles-admin-page__toolbar-actions">
            <button type="button" className="shell-btn shell-btn--secondary" onClick={onSeedDefaults} disabled={seeding}>
              {seeding ? "Seeding…" : String(copy.seedDefaultsLabel ?? "Seed defaults")}
            </button>
            <button type="button" className="shell-btn shell-btn--primary" onClick={startAdd} disabled={showForm}>
              {String(copy.addRoleLabel ?? "New role")}
            </button>
          </div>
        </div>
        {workspace.defaultRoles.length > 0 ? (
          <p className="lookup-admin-page__lede">{String(copy.seedDefaultsHint ?? "")}</p>
        ) : null}

        {customRoles.length === 0 && !showForm ? (
          <p>{String(copy.emptyCustom ?? "No custom roles.")}</p>
        ) : (
          <ul className="roles-admin-page__role-list">
            {customRoles.map((row) => (
              <li key={row.id} className="roles-admin-page__role-card">
                <div className="roles-admin-page__role-head">
                  <strong>{row.displayName}</strong>
                  <code>{row.roleKey}</code>
                  {row.isBuiltIn ? (
                    <span className="roles-admin-page__badge">App default</span>
                  ) : null}
                </div>
                {row.description ? <p className="roles-admin-page__desc">{row.description}</p> : null}
                <p className="roles-admin-page__perm-summary">
                  {row.permissions.length} permission{row.permissions.length === 1 ? "" : "s"}
                </p>
                <div className="roles-admin-page__card-actions">
                  <button type="button" className="cart-page__linkish" onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  {(!row.isBuiltIn || isAdmin) ? (
                    <button type="button" className="cart-page__linkish" onClick={() => void onDelete(row)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm ? (
        <section className="roles-admin-page__editor lookup-admin-page__panel">
          <h2>{editingId ? "Edit role" : "New custom role"}</h2>
          <JsonForm
            id={ROLE_FORM_ID}
            form={roleForm}
            resetKey={`role-${formResetKey}-${editingId ?? "new"}`}
            seedValues={formSeed}
            onSubmit={async (values) => {
              await onSave(values as Record<string, unknown>);
            }}
          >
            {editingId ? (
              <p className="lookup-admin-page__lede">
                Role key <code>{editingRow?.roleKey}</code> cannot be changed.
              </p>
            ) : null}
            <p className="lookup-admin-page__lede">{String(copy.permissionPickerLabel ?? "Permissions")}</p>
            <RolePermissionPicker
              catalog={catalog}
              groupOrder={workspace.permissionGroupOrder}
              selected={selectedPermissions}
              onChange={setSelectedPermissions}
              disabled={saving}
            />
            <LookupEntryFormActions
              formId={ROLE_FORM_ID}
              canSave={!!token && selectedPermissions.length > 0}
              saving={saving}
              showSaveAndAddAnother={false}
              onCancel={cancelForm}
            />
          </JsonForm>
        </section>
      ) : null}

      <p className="lookup-admin-page__lede">
        <Link to={isAdmin ? "/admin/vendors" : "/vendor/products"}>Back to portal</Link>
      </p>
    </div>
  );
}
