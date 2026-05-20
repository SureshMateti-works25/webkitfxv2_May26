import { getAtPath } from "@webkitfxv2/core-engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getPortalUsersAdminScreen } from "../config/getPortalUsersAdminScreen.js";
import {
  formatCommerceApiError,
  listAdminPortalUsers,
  patchAdminPortalUserLogin,
  type CommercePortalUserDirectoryRow,
} from "../lib/commerceApi.js";

export type AdminPortalUsersPageProps = {
  /** Which directory this route shows. */
  directory: "vendors" | "shoppers";
};

function formatCreated(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function AdminPortalUsersPage({ directory }: AdminPortalUsersPageProps) {
  const adminCopy = getPortalUsersAdminScreen().copy;
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();
  const roleFilter = directory === "vendors" ? "vendor" : "shopper";
  const title = directory === "vendors" ? "Vendors" : "Shoppers";

  const adminUserId = useMemo(() => {
    if (auth.status !== "signedIn") return "";
    return String(getAtPath(auth.payload, "session.userId") ?? "").trim();
  }, [auth]);

  const [rows, setRows] = useState<CommercePortalUserDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = getAccessToken();
    if (!t) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listAdminPortalUsers(t, { role: roleFilter });
      setRows(list);
    } catch (e) {
      setError(formatCommerceApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleLogin = async (row: CommercePortalUserDirectoryRow, nextDisabled: boolean) => {
    const t = getAccessToken();
    if (!t) return;
    if (row.id === adminUserId) {
      setError("You cannot disable or enable sign-in for your own account from this screen.");
      return;
    }
    setError(null);
    setMutatingId(row.id);
    try {
      const updated = await patchAdminPortalUserLogin(t, row.id, nextDisabled);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setMutatingId(null);
    }
  };

  if (auth.status !== "signedIn" || auth.role !== "admin") {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">{title}</h1>
        <p className="lookup-admin-page__lede">Sign in with a site administrator account to view this directory.</p>
        <p>
          <Link className="shell-btn shell-btn--primary" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">{title}</h1>
        <p className="lookup-admin-page__form-error" role="alert">
          No access token in session. Sign in again.
        </p>
      </div>
    );
  }

  return (
    <div className="lookup-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{title}</h1>
        <p className="lookup-admin-page__lede">
          Portal accounts with the <strong>{roleFilter}</strong> role. Use <strong>Disable sign-in</strong> to block
          password login (for example after abuse review); they will see a clear message at login.{" "}
          <strong>Enable sign-in</strong> restores access. You cannot change your own account here.
        </p>
        {directory === "vendors" ? (
          <p className="lookup-admin-page__lede">
            <Link className="shell-btn shell-btn--primary" to="/admin/portal-users/new">
              {String(adminCopy.listCreateCta ?? "Create account")}
            </Link>
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="lookup-admin-page__panel" aria-labelledby="portal-dir-heading">
        <h2 id="portal-dir-heading" className="lookup-admin-page__panel-title">
          Accounts
        </h2>
        {loading ? (
          <p className="lookup-admin-page__empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="lookup-admin-page__empty">No {roleFilter} accounts yet.</p>
        ) : (
          <div className="lookup-admin-page__types-table-wrap">
            <table className="lookup-admin-page__types-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">User id</th>
                  <th scope="col">Created</th>
                  <th scope="col">Sign-in</th>
                  <th scope="col">Status</th>
                  <th scope="col">Roles</th>
                  <th scope="col">
                    <span className="lookup-admin-page__sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelf = r.id === adminUserId;
                  const busy = mutatingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td>{r.email}</td>
                      <td>
                        <code className="lookup-admin-page__types-code">{r.id}</code>
                      </td>
                      <td>{formatCreated(r.createdAt)}</td>
                      <td>{r.loginDisabled ? "Disabled" : "Allowed"}</td>
                      <td>
                        {r.mustChangePassword ? (
                          <span className="lookup-admin-page__hint">
                            {String(adminCopy.mustChangeBadge ?? "Must set password")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/admin/portal-users/${encodeURIComponent(r.id)}`}
                          className="cart-page__linkish"
                        >
                          {String(adminCopy.listEditProfile ?? "Profile")}
                        </Link>
                        {" · "}
                        <Link
                          to={`/admin/portal-users/${encodeURIComponent(r.id)}/role-assignments`}
                          className="cart-page__linkish"
                        >
                          Roles
                        </Link>
                      </td>
                      <td>
                        {isSelf ? (
                          <span className="lookup-admin-page__hint">This is you</span>
                        ) : r.loginDisabled ? (
                          <button
                            type="button"
                            className="shell-btn shell-btn--outline"
                            disabled={busy}
                            onClick={() => void onToggleLogin(r, false)}
                          >
                            {busy ? "…" : "Enable sign-in"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="shell-btn shell-btn--ghost"
                            disabled={busy}
                            onClick={() => void onToggleLogin(r, true)}
                          >
                            {busy ? "…" : "Disable sign-in"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="lookup-admin-page__footer">
        <p className="lookup-admin-page__registry-note">
          For other admin tools, use <Link to="/admin/lookups">Lookups</Link>,{" "}
          <Link to="/admin/storefront-ads">Storefront sponsored ads</Link>, or the account menu.
        </p>
      </footer>
    </div>
  );
}
