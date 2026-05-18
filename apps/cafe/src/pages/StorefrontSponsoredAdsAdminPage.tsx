import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import {
  createCommerceSponsoredAdmin,
  deleteCommerceSponsoredAdmin,
  formatCommerceApiError,
  listCommerceSponsoredAdmin,
  updateCommerceSponsoredAdmin,
  type CommerceSponsoredProductAdmin,
} from "../lib/commerceApi.js";

export function StorefrontSponsoredAdsAdminPage() {
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();

  const [rows, setRows] = useState<CommerceSponsoredProductAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const refresh = useCallback(async () => {
    const t = getAccessToken();
    if (!t) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listCommerceSponsoredAdmin(t);
      setRows(list);
    } catch (e) {
      setLoadError(formatCommerceApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (auth.status !== "signedIn" || auth.role !== "admin") {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">Storefront sponsored products</h1>
        <p className="lookup-admin-page__lede">Sign in with an admin account to manage sponsored catalogue items.</p>
        <p>
          <Link className="shell-btn shell-btn--primary" to="/login">
            Sign in
          </Link>
        </p>
        <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
          In local development you can mint an admin JWT from Commerce.Api <code>POST /api/v1/dev/jwt</code> with{" "}
          <code>{`{ "role": "admin" }`}</code>, then paste the token via your usual dev sign-in flow if supported.
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">Storefront sponsored products</h1>
        <p className="lookup-admin-page__form-error" role="alert">
          No access token in session. Sign in again.
        </p>
      </div>
    );
  }

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const pid = productId.trim();
    if (!pid) {
      setFormError("Enter a catalogue product id (for example p_kj001).");
      return;
    }
    setSaving(true);
    try {
      await createCommerceSponsoredAdmin(token, {
        productId: pid,
        label: label.trim() || undefined,
        sortOrder,
        isActive: true,
      });
      setProductId("");
      setLabel("");
      setSortOrder(0);
      await refresh();
    } catch (err) {
      setFormError(formatCommerceApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (row: CommerceSponsoredProductAdmin) => {
    setFormError(null);
    try {
      await updateCommerceSponsoredAdmin(token, row.id, { isActive: !row.isActive });
      await refresh();
    } catch (err) {
      setFormError(formatCommerceApiError(err));
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Remove this sponsored placement?")) return;
    setFormError(null);
    try {
      await deleteCommerceSponsoredAdmin(token, id);
      await refresh();
    } catch (err) {
      setFormError(formatCommerceApiError(err));
    }
  };

  const onPatchSort = async (row: CommerceSponsoredProductAdmin, next: number) => {
    setFormError(null);
    try {
      await updateCommerceSponsoredAdmin(token, row.id, { sortOrder: next });
      await refresh();
    } catch (err) {
      setFormError(formatCommerceApiError(err));
    }
  };

  return (
    <div className="lookup-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">Storefront sponsored products</h1>
        <p className="lookup-admin-page__lede">
          Curate products that appear in the right-hand “Sponsored picks” rail on the storefront. Only{" "}
          <strong>active</strong> products are shown to shoppers.
        </p>
      </header>

      {loadError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {formError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="lookup-admin-page__grid">
        <section className="lookup-admin-page__panel" aria-labelledby="sponsor-add-heading">
          <h2 id="sponsor-add-heading" className="lookup-admin-page__panel-title">
            Add placement
          </h2>
          <form className="lookup-admin-page__form" onSubmit={onAdd}>
            <label className="lookup-admin-page__field">
              <span className="lookup-admin-page__label">Product id</span>
              <input
                className="lookup-admin-page__select"
                value={productId}
                onChange={(ev) => setProductId(ev.target.value)}
                placeholder="p_kj001"
                autoComplete="off"
                required
              />
            </label>
            <label className="lookup-admin-page__field">
              <span className="lookup-admin-page__label">Label (optional)</span>
              <input
                className="lookup-admin-page__select"
                value={label}
                onChange={(ev) => setLabel(ev.target.value)}
                placeholder="Featured vendor"
                maxLength={160}
              />
            </label>
            <label className="lookup-admin-page__field">
              <span className="lookup-admin-page__label">Sort order</span>
              <input
                className="lookup-admin-page__select"
                type="number"
                value={sortOrder}
                onChange={(ev) => setSortOrder(Number(ev.target.value))}
              />
            </label>
            <div className="lookup-admin-page__form-actions">
              <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
                {saving ? "Saving…" : "Add sponsored product"}
              </button>
            </div>
          </form>
        </section>

        <section className="lookup-admin-page__panel" aria-labelledby="sponsor-list-heading">
          <h2 id="sponsor-list-heading" className="lookup-admin-page__panel-title">
            Current placements
          </h2>
          {loading ? (
            <p className="lookup-admin-page__empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="lookup-admin-page__empty">No sponsored rows yet.</p>
          ) : (
            <div className="lookup-admin-page__types-table-wrap">
              <table className="lookup-admin-page__types-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Status</th>
                    <th scope="col">Sort</th>
                    <th scope="col">Active</th>
                    <th scope="col">
                      <span className="lookup-admin-page__sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div>
                          <code className="lookup-admin-page__types-code">{r.productId}</code>
                        </div>
                        <div className="lookup-admin-page__label-text">{r.titleDisplay}</div>
                        <Link to={`/p/${encodeURIComponent(r.slug)}`} className="promotion-card__cta-link">
                          Open PDP
                        </Link>
                      </td>
                      <td>{r.status}</td>
                      <td>
                        <div className="lookup-admin-page__sort-controls">
                          <button
                            type="button"
                            className="shell-btn shell-btn--ghost"
                            onClick={() => void onPatchSort(r, r.sortOrder - 1)}
                            aria-label="Decrease sort order"
                          >
                            −
                          </button>
                          <span>{r.sortOrder}</span>
                          <button
                            type="button"
                            className="shell-btn shell-btn--ghost"
                            onClick={() => void onPatchSort(r, r.sortOrder + 1)}
                            aria-label="Increase sort order"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <button type="button" className="shell-btn shell-btn--outline" onClick={() => void onToggleActive(r)}>
                          {r.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="shell-btn shell-btn--ghost" onClick={() => void onDelete(r.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
