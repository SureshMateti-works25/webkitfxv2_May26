import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import {
  createVendorProduct,
  deleteVendorProduct,
  formatCommerceApiError,
  getVendorProductWorkspace,
  listCatalogCategories,
  mediaAssetUrl,
  putVendorProductWorkspace,
  uploadVendorProductMedia,
  type CatalogCategoryRow,
  type VendorProductWorkspace,
  type VendorWorkspaceSku,
} from "../lib/commerceApi.js";
import {
  vendorProductCollectionsForm,
  vendorProductCoreForm,
  vendorProductEnquiriesForm,
  vendorProductFacetsForm,
  vendorProductOrdersForm,
  vendorProductPricingForm,
  vendorProductTaxForm,
  vendorProductTypeSareeForm,
} from "../config/forms/index.js";

type TabId =
  | "product"
  | "variants"
  | "media"
  | "pricing"
  | "inventory"
  | "tax"
  | "collections"
  | "attributes"
  | "enquiries"
  | "orders"
  | "typeAttrs";

const TABS: { id: TabId; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "variants", label: "Variants" },
  { id: "media", label: "Media" },
  { id: "pricing", label: "Price / offers" },
  { id: "inventory", label: "Inventory" },
  { id: "tax", label: "Tax" },
  { id: "collections", label: "Collections" },
  { id: "attributes", label: "Attributes" },
  { id: "enquiries", label: "Enquiries" },
  { id: "orders", label: "Orders" },
  { id: "typeAttrs", label: "Type extras" },
];

const MEDIA_ROLE_PRESETS = ["hero", "gallery", "front", "back", "detail", "drape", "pallu", "swatch"] as const;

function minorFromRupeesInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function workspaceToFormSeed(ws: VendorProductWorkspace): Record<string, unknown> {
  const core = { ...(ws.core as Record<string, unknown>) };
  const minMinor = core.minPriceMinor;
  core.minPriceRupees =
    minMinor != null && typeof minMinor === "number" ? String(minMinor / 100) : "";
  return {
    core,
    collections: ws.collections ?? { idsCsv: "" },
    attributes: { ...ws.attributes },
    commerce: JSON.parse(JSON.stringify(ws.commerce ?? {})) as Record<string, unknown>,
    skus: ws.skus,
    media: ws.media,
    inventory: ws.inventory,
    locations: ws.locations,
  };
}

function corePayloadFromForm(values: Record<string, unknown>): Record<string, unknown> {
  const core = { ...(values.core as Record<string, unknown>) };
  const rupees = String(core.minPriceRupees ?? "").trim();
  delete core.minPriceRupees;
  if (rupees.length > 0) core.minPriceMinor = minorFromRupeesInput(rupees);
  else core.minPriceMinor = null;
  return core;
}

export function VendorProductEditPage() {
  const { productId } = useParams<{ productId: string }>();
  const { auth, getAccessToken } = useAuth();
  const navigate = useNavigate();
  const isNew = productId === "new";

  const [categories, setCategories] = useState<CatalogCategoryRow[]>([]);
  const [workspace, setWorkspace] = useState<VendorProductWorkspace | null>(null);
  const [workspaceRev, setWorkspaceRev] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("product");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sectionMsg, setSectionMsg] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newStatus, setNewStatus] = useState<"draft" | "active">("draft");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPriceInr, setNewPriceInr] = useState("");
  const [newCurrency, setNewCurrency] = useState("INR");
  const [newProductTypeId, setNewProductTypeId] = useState("");

  const [skuRows, setSkuRows] = useState<VendorWorkspaceSku[]>([]);
  const [invRows, setInvRows] = useState<
    { skuId: string; locationId: string; onHand: number; reserved: number }[]
  >([]);

  const [mediaRole, setMediaRole] = useState("gallery");
  const [mediaSkuId, setMediaSkuId] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const token = getAccessToken();

  const loadWorkspace = useCallback(async () => {
    if (!productId || isNew || !token) return;
    setError(null);
    const ws = await getVendorProductWorkspace(token, productId);
    setWorkspace(ws);
    setSkuRows(ws.skus.map((s) => ({ ...s })));
    setInvRows(
      ws.inventory.map((i) => ({
        skuId: i.skuId,
        locationId: i.locationId,
        onHand: i.onHand,
        reserved: i.reserved,
      }))
    );
    setWorkspaceRev((r) => r + 1);
  }, [productId, isNew, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await listCatalogCategories();
        if (!cancelled) setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)));
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew || !token || !productId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadWorkspace();
      } catch (e) {
        if (!cancelled) setError(formatCommerceApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, productId, token, loadWorkspace]);

  const formSeed = useMemo(() => (workspace ? workspaceToFormSeed(workspace) : null), [workspace]);

  const productTypeIdStr = String(
    workspace?.core && typeof workspace.core === "object" && workspace.core !== null && "productTypeId" in workspace.core
      ? (workspace.core as { productTypeId?: string }).productTypeId ?? ""
      : ""
  );
  const showSareeTypeForm =
    productTypeIdStr.toLowerCase().includes("saree") || productTypeIdStr === "pt_saree";

  if (auth.status !== "signedIn") return <Navigate to="/login" replace />;
  if (auth.role !== "vendor") return <Navigate to="/" replace />;
  if (!token) return <Navigate to="/login" replace />;

  const onCancel = () => navigate("/vendor/products");

  const onCreate = async () => {
    setError(null);
    const t = newTitle.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await createVendorProduct(token, {
        title: t,
        slug: newSlug.trim() || undefined,
        status: newStatus,
        categoryId: newCategoryId.trim() || undefined,
        productTypeId: newProductTypeId.trim() || undefined,
        minPriceMinor: minorFromRupeesInput(newPriceInr) ?? undefined,
        currency: newCurrency.trim() || "INR",
      });
      navigate(`/vendor/products/${id}`, { replace: true });
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (isNew || !productId) return;
    if (!window.confirm("Delete this product permanently? This cannot be undone.")) return;
    setSaving(true);
    try {
      await deleteVendorProduct(token, productId);
      navigate("/vendor/products");
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const flash = (msg: string) => {
    setSectionMsg(msg);
    setTimeout(() => setSectionMsg(null), 3200);
  };

  if (isNew) {
    return (
      <div className="vendor-product-edit">
        <nav className="vendor-product-edit__back">
          <Link to="/vendor/products">← My products</Link>
        </nav>
        <h1 className="vendor-product-edit__title">New product</h1>
        {error ? (
          <p role="alert" className="vendor-products-page__error">
            {error}
          </p>
        ) : null}
        <div className="vendor-product-edit__form">
          <label className="vendor-field">
            <span>Title</span>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoComplete="off" />
          </label>
          <label className="vendor-field">
            <span>Slug (optional)</span>
            <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
          </label>
          <label className="vendor-field">
            <span>Status</span>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as "draft" | "active")}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </label>
          <label className="vendor-field">
            <span>Product type id</span>
            <input
              value={newProductTypeId}
              onChange={(e) => setNewProductTypeId(e.target.value)}
              placeholder="e.g. pt_saree"
            />
          </label>
          <label className="vendor-field">
            <span>Category</span>
            <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug} ({c.id})
                </option>
              ))}
            </select>
          </label>
          <div className="vendor-field-row">
            <label className="vendor-field vendor-field--grow">
              <span>Price (rupees)</span>
              <input value={newPriceInr} onChange={(e) => setNewPriceInr(e.target.value)} inputMode="decimal" />
            </label>
            <label className="vendor-field">
              <span>Currency</span>
              <input value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} maxLength={8} />
            </label>
          </div>
        </div>
        <div className="vendor-product-edit__actions">
          <button type="button" className="shell-btn shell-btn--outline" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="shell-btn shell-btn--primary" onClick={() => void onCreate()} disabled={saving}>
            {saving ? "Creating…" : "Create & open workspace"}
          </button>
        </div>
      </div>
    );
  }

  if (!productId) return <Navigate to="/vendor/products" replace />;

  if (!workspace && !error) {
    return (
      <div className="vendor-product-edit">
        <p>Loading workspace…</p>
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="vendor-product-edit">
        <p role="alert" className="vendor-products-page__error">
          {error}
        </p>
        <Link to="/vendor/products">Back to my products</Link>
      </div>
    );
  }

  if (!formSeed) return null;

  return (
    <div className="vendor-product-edit vendor-product-edit--workspace">
      <nav className="vendor-product-edit__back">
        <Link to="/vendor/products">← My products</Link>
      </nav>

      <header className="vendor-workspace-header">
        <h1 className="vendor-product-edit__title">Product workspace</h1>
        <p className="vendor-workspace-header__id">
          <span>{String(formSeed.core && (formSeed.core as { id?: string }).id)}</span>
        </p>
      </header>

      {error ? (
        <p role="alert" className="vendor-products-page__error">
          {error}
        </p>
      ) : null}
      {sectionMsg ? (
        <p className="vendor-workspace-msg" role="status">
          {sectionMsg}
        </p>
      ) : null}

      <div className="vendor-pills" role="tablist" aria-label="Product sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`vendor-pill${activeTab === t.id ? " vendor-pill--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="vendor-workspace-panel">
        {activeTab === "product" ? (
          <JsonForm
            form={vendorProductCoreForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                await putVendorProductWorkspace(token, productId, {
                  core: corePayloadFromForm(values),
                });
                await loadWorkspace();
                flash("Product section saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save product
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "variants" ? (
          <section className="vendor-workspace-section">
            <h2 className="vendor-workspace-section__title">SKUs / variants</h2>
            <p className="vendor-workspace-section__hint">
              One row per sellable SKU. List / compare prices are in minor units (paise); leave blank to omit.
            </p>
            <div className="vendor-table-wrap">
              <table className="vendor-table">
                <thead>
                  <tr>
                    <th>Sku code</th>
                    <th>Barcode</th>
                    <th>Status</th>
                    <th>List (paise)</th>
                    <th>Compare (paise)</th>
                  </tr>
                </thead>
                <tbody>
                  {skuRows.map((row, i) => (
                    <tr key={row.id || `new-${i}`}>
                      <td>
                        <input
                          value={row.skuCode}
                          onChange={(e) => {
                            const next = [...skuRows];
                            next[i] = { ...row, skuCode: e.target.value };
                            setSkuRows(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.barcode ?? ""}
                          onChange={(e) => {
                            const next = [...skuRows];
                            next[i] = { ...row, barcode: e.target.value };
                            setSkuRows(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.status}
                          onChange={(e) => {
                            const next = [...skuRows];
                            next[i] = { ...row, status: e.target.value };
                            setSkuRows(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.listPriceMinor ?? ""}
                          onChange={(e) => {
                            const next = [...skuRows];
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            next[i] = { ...row, listPriceMinor: v };
                            setSkuRows(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.compareAtPriceMinor ?? ""}
                          onChange={(e) => {
                            const next = [...skuRows];
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            next[i] = { ...row, compareAtPriceMinor: v };
                            setSkuRows(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="vendor-workspace-section__actions">
              <button
                type="button"
                className="shell-btn shell-btn--outline"
                onClick={() =>
                  setSkuRows([
                    ...skuRows,
                    {
                      id: "",
                      skuCode: "",
                      barcode: "",
                      status: "active",
                      listPriceMinor: null,
                      compareAtPriceMinor: null,
                    },
                  ])
                }
              >
                Add SKU row
              </button>
              <button
                type="button"
                className="shell-btn shell-btn--primary"
                disabled={saving}
                onClick={async () => {
                  if (!productId) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await putVendorProductWorkspace(token, productId, {
                      skus: skuRows.map((r) => ({
                        id: r.id || undefined,
                        skuCode: r.skuCode,
                        barcode: r.barcode ?? undefined,
                        status: r.status,
                        listPriceMinor: r.listPriceMinor,
                        compareAtPriceMinor: r.compareAtPriceMinor,
                      })),
                    });
                    await loadWorkspace();
                    flash("Variants saved.");
                  } catch (e) {
                    setError(formatCommerceApiError(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save variants
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "media" ? (
          <section className="vendor-workspace-section">
            <h2 className="vendor-workspace-section__title">Media</h2>
            <p className="vendor-workspace-section__hint">
              Upload product shots (angles) or variant-specific images. Product-level rows apply to the whole listing;
              variant rows are tied to one SKU. Save SKUs on the Variants tab before attaching variant images.
            </p>

            <div className="vendor-media-upload">
              <div className="vendor-media-upload__row">
                <label className="vendor-field vendor-field--grow">
                  <span>Role / angle</span>
                  <input
                    list="vendor-media-role-presets"
                    value={mediaRole}
                    onChange={(e) => setMediaRole(e.target.value)}
                    placeholder="e.g. front, hero, swatch"
                    autoComplete="off"
                  />
                  <datalist id="vendor-media-role-presets">
                    {MEDIA_ROLE_PRESETS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </label>
                <label className="vendor-field vendor-field--grow">
                  <span>Attach to</span>
                  <select value={mediaSkuId} onChange={(e) => setMediaSkuId(e.target.value)}>
                    <option value="">Whole product (all variants)</option>
                    {(workspace?.skus ?? skuRows).map((s) => (
                      <option key={s.id} value={s.id}>
                        Variant: {s.skuCode || s.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="vendor-media-upload__actions">
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="vendor-media-upload__input-native"
                  disabled={mediaUploading || !productId}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    if (!files?.length || !productId) return;
                    if (!token) {
                      setError("Your session has no access token. Sign out and sign in again.");
                      return;
                    }
                    void (async () => {
                      setMediaUploading(true);
                      setError(null);
                      try {
                        const role = mediaRole.trim() || "gallery";
                        const sku = mediaSkuId.trim() || undefined;
                        for (const file of Array.from(files)) {
                          await uploadVendorProductMedia(token, productId, file, {
                            role,
                            skuId: sku,
                          });
                        }
                        await loadWorkspace();
                        flash(
                          files.length === 1
                            ? "Image uploaded."
                            : `${files.length} images uploaded.`
                        );
                      } catch (err) {
                        setError(formatCommerceApiError(err));
                      } finally {
                        setMediaUploading(false);
                      }
                    })();
                  }}
                />
                <button
                  type="button"
                  className="shell-btn shell-btn--primary"
                  disabled={mediaUploading || !productId}
                  onClick={() => mediaFileInputRef.current?.click()}
                >
                  {mediaUploading ? "Uploading…" : "Choose image(s) to upload"}
                </button>
              </div>
            </div>

            <ul className="vendor-media-grid">
              {(workspace?.media ?? []).length === 0 ? (
                <li className="vendor-media-grid__empty">No media yet. Upload images above.</li>
              ) : (
                (workspace?.media ?? []).map((m) => {
                  const href = mediaAssetUrl(m.storageKey);
                  const skuLabel = m.skuId
                    ? (workspace?.skus ?? skuRows).find((s) => s.id === m.skuId)?.skuCode ?? m.skuId
                    : null;
                  return (
                    <li key={m.id} className="vendor-media-card">
                      <a href={href} target="_blank" rel="noreferrer" className="vendor-media-card__thumb">
                        <img src={href} alt="" loading="lazy" />
                      </a>
                      <div className="vendor-media-card__meta">
                        <strong>{m.role}</strong>
                        {skuLabel ? (
                          <span className="vendor-media-card__sku">Variant: {skuLabel}</span>
                        ) : (
                          <span className="vendor-media-card__sku vendor-media-card__sku--product">Product</span>
                        )}
                        <span className="vendor-media-card__mime">{m.mimeType}</span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <JsonForm
            form={vendorProductPricingForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const pricing = getAtPath(values, "commerce.pricing");
                await putVendorProductWorkspace(token, productId, {
                  commercePatch: { pricing: pricing ?? {} },
                });
                await loadWorkspace();
                flash("Pricing saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save pricing
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "inventory" ? (
          <section className="vendor-workspace-section">
            <h2 className="vendor-workspace-section__title">Inventory / stock</h2>
            <p className="vendor-workspace-section__hint">Edit on-hand per SKU and location. Save applies upserts.</p>
            <div className="vendor-table-wrap">
              <table className="vendor-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {invRows.map((row, i) => (
                    <tr key={`${row.skuId}-${row.locationId}-${i}`}>
                      <td>
                        <select
                          value={row.skuId}
                          onChange={(e) => {
                            const next = [...invRows];
                            next[i] = { ...row, skuId: e.target.value };
                            setInvRows(next);
                          }}
                        >
                          <option value="">—</option>
                          {(workspace?.skus ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.skuCode}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.locationId}
                          onChange={(e) => {
                            const next = [...invRows];
                            next[i] = { ...row, locationId: e.target.value };
                            setInvRows(next);
                          }}
                        >
                          <option value="">—</option>
                          {(workspace?.locations ?? []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} — {l.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.onHand}
                          onChange={(e) => {
                            const next = [...invRows];
                            next[i] = { ...row, onHand: Number(e.target.value) || 0 };
                            setInvRows(next);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.reserved}
                          onChange={(e) => {
                            const next = [...invRows];
                            next[i] = { ...row, reserved: Number(e.target.value) || 0 };
                            setInvRows(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="vendor-workspace-section__actions">
              <button
                type="button"
                className="shell-btn shell-btn--outline"
                onClick={() => setInvRows([...invRows, { skuId: "", locationId: "", onHand: 0, reserved: 0 }])}
              >
                Add stock row
              </button>
              <button
                type="button"
                className="shell-btn shell-btn--primary"
                disabled={saving}
                onClick={async () => {
                  if (!productId) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await putVendorProductWorkspace(token, productId, {
                      inventory: invRows
                        .filter((r) => r.skuId && r.locationId)
                        .map((r) => ({
                          skuId: r.skuId,
                          locationId: r.locationId,
                          onHand: r.onHand,
                          reserved: r.reserved,
                        })),
                    });
                    await loadWorkspace();
                    flash("Inventory saved.");
                  } catch (e) {
                    setError(formatCommerceApiError(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save inventory
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "tax" ? (
          <JsonForm
            form={vendorProductTaxForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const tax = getAtPath(values, "commerce.tax");
                await putVendorProductWorkspace(token, productId, {
                  commercePatch: { tax: tax ?? {} },
                });
                await loadWorkspace();
                flash("Tax saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save tax
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "collections" ? (
          <JsonForm
            form={vendorProductCollectionsForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const csv = String(getAtPath(values, "collections.idsCsv") ?? "").trim();
                const collectionIds = csv.length === 0 ? [] : csv.split(",").map((s) => s.trim()).filter(Boolean);
                await putVendorProductWorkspace(token, productId, { collectionIds });
                await loadWorkspace();
                flash("Collections saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save collections
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "attributes" ? (
          <JsonForm
            form={vendorProductFacetsForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const attrs = (values.attributes ?? {}) as Record<string, string>;
                const attributes: Record<string, string> = {};
                for (const [k, v] of Object.entries(attrs)) {
                  const t = String(v ?? "").trim();
                  if (t.length > 0) attributes[k] = t;
                }
                await putVendorProductWorkspace(token, productId, { attributes });
                await loadWorkspace();
                flash("Attributes saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save attributes
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "enquiries" ? (
          <JsonForm
            form={vendorProductEnquiriesForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const enq = getAtPath(values, "commerce.enquiries") as Record<string, unknown> | undefined;
                const patch = { ...enq };
                const oc = patch.openCount;
                if (typeof oc === "string") patch.openCount = Number.parseInt(oc, 10) || 0;
                await putVendorProductWorkspace(token, productId, {
                  commercePatch: { enquiries: patch },
                });
                await loadWorkspace();
                flash("Enquiries stub saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save enquiries
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "orders" ? (
          <JsonForm
            form={vendorProductOrdersForm}
            seedValues={formSeed}
            resetKey={workspaceRev}
            onSubmit={async (values) => {
              if (!productId) return;
              setSaving(true);
              setError(null);
              try {
                const orders = getAtPath(values, "commerce.orders");
                await putVendorProductWorkspace(token, productId, {
                  commercePatch: { orders: orders ?? {} },
                });
                await loadWorkspace();
                flash("Orders stub saved.");
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
              Save orders note
            </button>
          </JsonForm>
        ) : null}

        {activeTab === "typeAttrs" ? (
          <>
            {!showSareeTypeForm ? (
              <p className="vendor-workspace-section__hint">
                Set <strong>Product type id</strong> to something containing &ldquo;saree&rdquo; (e.g.{" "}
                <code>pt_saree</code>) on the Product tab to edit saree-specific fields, or extend JSON forms for
                other <code>productTypes</code> from the catalog domain model.
              </p>
            ) : null}
            {showSareeTypeForm ? (
              <JsonForm
                form={vendorProductTypeSareeForm}
                seedValues={formSeed}
                resetKey={workspaceRev}
                onSubmit={async (values) => {
                  if (!productId) return;
                  setSaving(true);
                  setError(null);
                  try {
                    const ta = getAtPath(values, "commerce.typeAttributes");
                    await putVendorProductWorkspace(token, productId, {
                      commercePatch: { typeAttributes: ta ?? {} },
                    });
                    await loadWorkspace();
                    flash("Type attributes saved.");
                  } catch (e) {
                    setError(formatCommerceApiError(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <button type="submit" className="shell-btn shell-btn--primary" disabled={saving}>
                  Save type attributes
                </button>
              </JsonForm>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="vendor-product-edit__actions vendor-product-edit__actions--footer">
        <button type="button" className="shell-btn shell-btn--outline" onClick={onCancel} disabled={saving}>
          Back to list
        </button>
        <button type="button" className="shell-btn vendor-product-edit__delete" onClick={() => void onDelete()} disabled={saving}>
          Delete product
        </button>
      </div>
    </div>
  );
}
