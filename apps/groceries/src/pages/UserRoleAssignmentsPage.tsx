import { getAtPath } from "@webkitfxv2/core-engine";
import type { FormDefinition } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupEntryFormActions } from "../components/LookupEntryFormActions.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { getForm } from "../config/forms/index.js";
import { getUserRoleAssignmentsWorkspace } from "../config/getUserRoleAssignmentsWorkspace.js";
import {
  createPortalUserRoleAssignment,
  deletePortalUserRoleAssignment,
  fetchTenantRoles,
  fetchPortalUserRoleAssignments,
  formatCommerceApiError,
  updatePortalUserRoleAssignment,
  type CommercePortalRoleAssignmentRow,
  type CommerceTenantRoleRow,
} from "../lib/commerceApi.js";

const ASSIGNMENT_FORM_ID = "user-role-assignment-form";

function assignmentSeed(row: CommercePortalRoleAssignmentRow | null, defaultPortalBase: string): Record<string, unknown> {
  if (!row) {
    return {
      assignment: {
        roleKey: "",
        portalBaseRole: defaultPortalBase,
        isPrimary: true,
      },
    };
  }
  return {
    assignment: {
      roleKey: row.roleKey,
      portalBaseRole: row.portalBaseRole,
      isPrimary: row.isPrimary,
    },
  };
}

function mergeAssignmentForm(
  form: FormDefinition,
  roleOptions: { value: string; label: string }[],
  portalOptions: { value: string; label: string }[]
): FormDefinition {
  const roleField = form.fields.roleKey;
  const portalField = form.fields.portalBaseRole;
  if (!roleField || !portalField) return form;
  return {
    ...form,
    fields: {
      ...form.fields,
      roleKey: {
        ...roleField,
        props: {
          ...(roleField.props as Record<string, unknown>),
          options: roleOptions,
        },
      },
      portalBaseRole: {
        ...portalField,
        props: {
          ...(portalField.props as Record<string, unknown>),
          options: portalOptions,
        },
      },
    },
  };
}

export function UserRoleAssignmentsPage() {
  const { portalUserId = "" } = useParams<{ portalUserId: string }>();
  const workspace = getUserRoleAssignmentsWorkspace();
  const copy = getScreenConfig(workspace.screenId);
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();

  const [email, setEmail] = useState("");
  const [portalRole, setPortalRole] = useState("");
  const [assignments, setAssignments] = useState<CommercePortalRoleAssignmentRow[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<CommerceTenantRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const backDirectory = useMemo(() => {
    const r = portalRole.trim().toLowerCase();
    if (r === "shopper") return { path: "/admin/shoppers", label: String(copy.backShoppers ?? "Back to shoppers") };
    return { path: "/admin/vendors", label: String(copy.backVendors ?? "Back to vendors") };
  }, [portalRole, copy.backShoppers, copy.backVendors]);

  const roleOptions = useMemo(
    () =>
      assignableRoles.map((r) => ({
        value: r.roleKey,
        label: r.isSystem ? `${r.displayName} (built-in)` : r.displayName,
      })),
    [assignableRoles]
  );

  const portalOptions = useMemo(
    () =>
      workspace.portalBaseRoleOptions.map((o) => ({
        value: o.value,
        label: o.label,
      })),
    [workspace.portalBaseRoleOptions]
  );

  const formBase = getForm(workspace.formId);
  const assignmentForm = useMemo(
    () => mergeAssignmentForm(formBase, roleOptions, portalOptions),
    [formBase, roleOptions, portalOptions]
  );

  const editingRow = editingId ? assignments.find((a) => a.id === editingId) : null;

  const load = useCallback(async () => {
    const t = getAccessToken();
    if (!t || !portalUserId) return;
    setLoading(true);
    setError(null);
    try {
      const [assignData, rolesData] = await Promise.all([
        fetchPortalUserRoleAssignments(t, portalUserId),
        fetchTenantRoles(t),
      ]);
      setEmail(assignData.email);
      setPortalRole(assignData.portalRole);
      setAssignments(assignData.assignments);
      setAssignableRoles([...rolesData.systemRoles, ...rolesData.customRoles]);
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, portalUserId]);

  useEffect(() => {
    if (auth.status === "signedIn" && workspace.allowedRoles.includes(auth.role)) {
      void load();
    }
  }, [auth.status, auth.role, load, workspace.allowedRoles]);

  if (auth.status !== "signedIn" || !workspace.allowedRoles.includes(auth.role)) {
    return <Navigate to="/login" replace />;
  }

  if (!portalUserId) {
    return <Navigate to="/admin/vendors" replace />;
  }

  const onSave = async (values: Record<string, unknown>) => {
    const t = getAccessToken();
    if (!t) return;
    const roleKey = String(getAtPath(values, "assignment.roleKey") ?? "").trim();
    const portalBaseRole = String(getAtPath(values, "assignment.portalBaseRole") ?? "").trim();
    const isPrimary = getAtPath(values, "assignment.isPrimary") === true;
    if (!roleKey || !portalBaseRole) {
      setError("Select a permission role and portal access level.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updatePortalUserRoleAssignment(t, portalUserId, editingId, {
          roleKey,
          portalBaseRole,
          isPrimary,
        });
      } else {
        await createPortalUserRoleAssignment(t, portalUserId, {
          roleKey,
          portalBaseRole,
          isPrimary,
        });
      }
      setShowAdd(false);
      setEditingId(null);
      setFormResetKey((k) => k + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: CommercePortalRoleAssignmentRow) => {
    const t = getAccessToken();
    if (!t) return;
    if (!window.confirm(`Remove assignment “${row.roleKey}”?`)) return;
    setError(null);
    try {
      await deletePortalUserRoleAssignment(t, portalUserId, row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setShowAdd(false);
      }
      await load();
    } catch (e) {
      setError(formatCommerceApiError(e));
    }
  };

  const showForm = showAdd || editingId != null;

  return (
    <div className="lookup-admin-page roles-admin-page user-role-assignments-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{String(copy.title ?? "Role assignments")}</h1>
        <p className="lookup-admin-page__lede">{String(copy.body ?? "")}</p>
        <p className="lookup-admin-page__lede">
          User: <strong>{email || portalUserId}</strong>
          {portalRole ? (
            <>
              {" "}
              · registered portal role: <code>{portalRole}</code>
            </>
          ) : null}
        </p>
        <p className="lookup-admin-page__lede lookup-admin-page__lede--meta">
          <code>config/workspaces/user-role-assignments.json</code>
        </p>
      </header>

      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p aria-live="polite">Loading…</p> : null}

      <section className="roles-admin-page__section">
        <div className="roles-admin-page__toolbar">
          <h2 className="roles-admin-page__section-title">
            {String(copy.assignmentsTitle ?? "Assignments")}
          </h2>
          <button
            type="button"
            className="shell-btn shell-btn--primary"
            disabled={showForm}
            onClick={() => {
              setEditingId(null);
              setShowAdd(true);
              setFormResetKey((k) => k + 1);
            }}
          >
            {String(copy.addLabel ?? "Add assignment")}
          </button>
        </div>

        {assignments.length === 0 && !showForm ? (
          <p>{String(copy.emptyAssignments ?? "")}</p>
        ) : (
          <ul className="roles-admin-page__role-list">
            {assignments.map((row) => (
              <li key={row.id} className="roles-admin-page__role-card">
                <div className="roles-admin-page__role-head">
                  <strong>{row.roleKey}</strong>
                  <code>{row.portalBaseRole}</code>
                  {row.isPrimary ? (
                    <span className="roles-admin-page__badge">
                      {String(copy.primaryBadge ?? "Primary")}
                    </span>
                  ) : null}
                </div>
                <div className="roles-admin-page__card-actions">
                  <button type="button" className="cart-page__linkish" onClick={() => {
                    setShowAdd(false);
                    setEditingId(row.id);
                    setFormResetKey((k) => k + 1);
                  }}>
                    Edit
                  </button>
                  <button type="button" className="cart-page__linkish" onClick={() => void onDelete(row)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm ? (
        <section className="roles-admin-page__editor lookup-admin-page__panel">
          <h2>{editingId ? "Edit assignment" : "New assignment"}</h2>
          <JsonForm
            id={ASSIGNMENT_FORM_ID}
            form={assignmentForm}
            resetKey={`assign-${formResetKey}-${editingId ?? "new"}`}
            seedValues={assignmentSeed(editingRow ?? null, workspace.defaultPortalBaseRole)}
            onSubmit={async (values) => {
              await onSave(values as Record<string, unknown>);
            }}
          >
            <LookupEntryFormActions
              formId={ASSIGNMENT_FORM_ID}
              canSave={!!token}
              saving={saving}
              showSaveAndAddAnother={false}
              onCancel={() => {
                setShowAdd(false);
                setEditingId(null);
              }}
            />
          </JsonForm>
        </section>
      ) : null}

      <p className="lookup-admin-page__lede">
        <Link to={backDirectory.path}>{backDirectory.label}</Link>
        {" · "}
        <Link to="/admin/roles">Manage role definitions</Link>
      </p>
    </div>
  );
}
