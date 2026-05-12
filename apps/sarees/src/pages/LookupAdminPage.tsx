import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { buildLookupEntryFormDefinition } from "../lib/buildLookupEntryForm.js";
import { commerceLookupTypeToTypeDef } from "../lib/commerceLookupMappers.js";
import {
  createCommerceLookupValue,
  deleteCommerceLookupValue,
  formatCommerceApiError,
  listCommerceLookupTypes,
  listCommerceLookupValues,
  upsertCommerceLookupType,
  type CommerceLookupTypeDto,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";

type LookupAdminSection = "types" | "values";

export function LookupAdminPage() {
  const { getAccessToken } = useAuth();
  const token = getAccessToken();

  const [types, setTypes] = useState<CommerceLookupTypeDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [entries, setEntries] = useState<CommerceLookupValueDto[]>([]);
  const [parentRows, setParentRows] = useState<CommerceLookupValueDto[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [listVersion, setListVersion] = useState(0);
  const [formResetKey, setFormResetKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [typeFormError, setTypeFormError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [newTypeId, setNewTypeId] = useState("");
  const [newTypeTitle, setNewTypeTitle] = useState("");
  const [newTypePrefix, setNewTypePrefix] = useState("lk_");
  const [newTypeParentId, setNewTypeParentId] = useState("");
  const [adminSection, setAdminSection] = useState<LookupAdminSection>("values");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTypesLoading(true);
      setLoadError(null);
      try {
        const t = await listCommerceLookupTypes();
        const sorted = [...t].sort((a, b) => a.id.localeCompare(b.id));
        if (!cancelled) setTypes(sorted);
      } catch (e) {
        if (!cancelled) setLoadError(formatCommerceApiError(e));
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0]!.id);
  }, [types, selectedTypeId]);

  const selectedDto = useMemo(
    () => types.find((t) => t.id === selectedTypeId),
    [types, selectedTypeId]
  );

  useEffect(() => {
    if (!selectedTypeId) return;
    let cancelled = false;
    (async () => {
      setListsLoading(true);
      setLoadError(null);
      try {
        const vals = await listCommerceLookupValues(selectedTypeId);
        if (cancelled) return;
        setEntries(vals);
        const dto = types.find((x) => x.id === selectedTypeId);
        if (dto?.parentLookupTypeId) {
          const parents = await listCommerceLookupValues(dto.parentLookupTypeId);
          if (!cancelled) setParentRows(parents);
        } else if (!cancelled) {
          setParentRows([]);
        }
      } catch (e) {
        if (!cancelled) setLoadError(formatCommerceApiError(e));
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, listVersion, types]);

  const typeDef = useMemo(() => (selectedDto ? commerceLookupTypeToTypeDef(selectedDto) : null), [selectedDto]);
  const parentOptions = useMemo(
    () => parentRows.map((e) => ({ value: e.id, label: `${e.label} (${e.code})` })),
    [parentRows]
  );
  const entryForm = useMemo(() => {
    if (!typeDef) return null;
    return buildLookupEntryFormDefinition(typeDef, parentOptions);
  }, [typeDef, parentOptions]);

  const bumpList = useCallback(() => setListVersion((v) => v + 1), []);

  const parentTypeTitle = useMemo(() => {
    if (!selectedDto?.parentLookupTypeId) return null;
    return types.find((t) => t.id === selectedDto.parentLookupTypeId)?.title ?? selectedDto.parentLookupTypeId;
  }, [types, selectedDto?.parentLookupTypeId]);

  const onAdd = useCallback(
    async (values: Record<string, unknown>) => {
      if (!typeDef || !entryForm || !selectedDto) return;
      setFormError(null);
      if (!token) {
        setFormError("Sign in to add lookup values (Commerce.Api requires a JWT).");
        return;
      }
      const code = String(getAtPath(values, "entry.code") ?? "")
        .trim()
        .toLowerCase();
      const label = String(getAtPath(values, "entry.label") ?? "").trim();
      const sortOrderRaw = getAtPath(values, "entry.sortOrder");
      const sortOrder =
        typeof sortOrderRaw === "number" && Number.isFinite(sortOrderRaw)
          ? Math.trunc(sortOrderRaw)
          : typeof sortOrderRaw === "string"
            ? Math.trunc(Number(sortOrderRaw)) || 0
            : 0;
      const parentIdRaw = typeDef.parentLookupId ? String(getAtPath(values, "entry.parentId") ?? "").trim() : "";
      const parentValueId = parentIdRaw || null;

      if (!code || !label) {
        setFormError("Code and label are required.");
        return;
      }
      if (typeDef.parentLookupId && !parentValueId) {
        setFormError("Choose a parent for this dependent lookup.");
        return;
      }

      try {
        await createCommerceLookupValue(token, selectedDto.id, {
          code,
          label,
          sortOrder,
          parentValueId: typeDef.parentLookupId ? parentValueId : null,
        });
        setFormResetKey((k) => k + 1);
        bumpList();
      } catch (e) {
        setFormError(formatCommerceApiError(e));
      }
    },
    [typeDef, entryForm, selectedDto, token, bumpList]
  );

  const onDelete = useCallback(
    async (entry: CommerceLookupValueDto) => {
      if (!token) {
        setFormError("Sign in to delete lookup values.");
        return;
      }
      setFormError(null);
      try {
        await deleteCommerceLookupValue(token, entry.id);
        bumpList();
      } catch (e) {
        setFormError(formatCommerceApiError(e));
      }
    },
    [token, bumpList]
  );

  const onCreateType = async () => {
    setTypeFormError(null);
    if (!token) {
      setTypeFormError("Sign in to create lookup types.");
      return;
    }
    const id = newTypeId.trim().toLowerCase();
    if (!id || !/^[a-z][a-z0-9_]{0,62}$/.test(id)) {
      setTypeFormError("Type id: start with a letter; then lowercase letters, digits, or underscore (max 63).");
      return;
    }
    const title = newTypeTitle.trim();
    if (!title) {
      setTypeFormError("Title is required.");
      return;
    }
    const prefix = newTypePrefix.trim() || "lk_";
    if (prefix.length < 1 || prefix.length > 32) {
      setTypeFormError("Entry id prefix: 1–32 characters.");
      return;
    }
    const parent = newTypeParentId.trim();
    if (parent && parent === id) {
      setTypeFormError("Parent lookup type cannot be the same as this type’s id.");
      return;
    }
    setSavingType(true);
    try {
      await upsertCommerceLookupType(token, id, {
        title,
        description: null,
        parentLookupTypeId: parent || null,
        parentFieldLabel: parent ? "Parent" : null,
        entryIdPrefix: prefix,
      });
      const t = await listCommerceLookupTypes();
      setTypes([...t].sort((a, b) => a.id.localeCompare(b.id)));
      setSelectedTypeId(id);
      setNewTypeId("");
      setNewTypeTitle("");
      setNewTypePrefix("lk_");
      setNewTypeParentId("");
    } catch (e) {
      setTypeFormError(formatCommerceApiError(e));
    } finally {
      setSavingType(false);
    }
  };

  if (typesLoading) {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">Lookup maintenance</h1>
        <p>Loading lookup types from Commerce.Api…</p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (loadError && types.length === 0) {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">Lookups</h1>
        <p className="lookup-admin-page__form-error" role="alert">
          {loadError}
        </p>
        <p className="lookup-admin-page__lede">
          Ensure Commerce.Api is running, <code>X-Tenant-Id</code> is set (e.g. <code>t1</code>), and migrations have created{" "}
          <code>lookup_types</code> / <code>lookup_values</code>.
        </p>
        <Link to="/">Home</Link>
      </div>
    );
  }

  if (!selectedDto || !typeDef || !entryForm) {
    return (
      <div className="lookup-admin-page">
        <h1 className="lookup-admin-page__title">Lookup maintenance</h1>
        {loadError ? (
          <p className="lookup-admin-page__form-error" role="alert">
            {loadError}
          </p>
        ) : null}
        <p>No lookup types found for this tenant. Create one in the section below (requires sign-in).</p>
        {!token ? (
          <p className="lookup-admin-page__warn" role="status">
            <Link to="/login">Sign in</Link> to add lookup types and values via the API.
          </p>
        ) : null}
        <LookupNewTypeSection
          types={types}
          canMutate={!!token}
          newTypeId={newTypeId}
          setNewTypeId={setNewTypeId}
          newTypeTitle={newTypeTitle}
          setNewTypeTitle={setNewTypeTitle}
          newTypePrefix={newTypePrefix}
          setNewTypePrefix={setNewTypePrefix}
          newTypeParentId={newTypeParentId}
          setNewTypeParentId={setNewTypeParentId}
          typeFormError={typeFormError}
          savingType={savingType}
          onCreateType={() => void onCreateType()}
        />
        <Link to="/">Home</Link>
      </div>
    );
  }

  return (
    <div className="lookup-admin-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">Lookup maintenance</h1>
        <p className="lookup-admin-page__lede">
          Types and values are stored in Postgres on Commerce.Api (<code>lookup_types</code>, <code>lookup_values</code>
          ). Reads use your tenant header; <strong>add / delete</strong> require a signed-in JWT. Dependent lookups use{" "}
          <code>parentLookupTypeId</code> on the type and <code>parentValueId</code> on each row.
        </p>
        {!token ? (
          <p className="lookup-admin-page__warn" role="status">
            <Link to="/login">Sign in</Link> to add or delete rows.
          </p>
        ) : null}
      </header>

      {loadError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="vendor-pills" role="tablist" aria-label="Lookup admin sections">
        <button
          type="button"
          role="tab"
          id="lookup-admin-tab-types"
          aria-controls="lookup-admin-panel-types"
          aria-selected={adminSection === "types"}
          className={`vendor-pill${adminSection === "types" ? " vendor-pill--active" : ""}`}
          onClick={() => setAdminSection("types")}
        >
          Lookup types
        </button>
        <button
          type="button"
          role="tab"
          id="lookup-admin-tab-values"
          aria-controls="lookup-admin-panel-values"
          aria-selected={adminSection === "values"}
          className={`vendor-pill${adminSection === "values" ? " vendor-pill--active" : ""}`}
          onClick={() => setAdminSection("values")}
        >
          Lookup values
        </button>
      </div>

      {adminSection === "types" ? (
        <div
          id="lookup-admin-panel-types"
          role="tabpanel"
          aria-labelledby="lookup-admin-tab-types"
          className="lookup-admin-page__tab-panel"
        >
          <section className="lookup-admin-page__panel lookup-admin-page__panel--compact" aria-labelledby="lookup-new-type-heading">
            <h2 id="lookup-new-type-heading" className="lookup-admin-page__panel-title">
              New lookup type
            </h2>
            <LookupNewTypeSection
              types={types}
              canMutate={!!token}
              newTypeId={newTypeId}
              setNewTypeId={setNewTypeId}
              newTypeTitle={newTypeTitle}
              setNewTypeTitle={setNewTypeTitle}
              newTypePrefix={newTypePrefix}
              setNewTypePrefix={setNewTypePrefix}
              newTypeParentId={newTypeParentId}
              setNewTypeParentId={setNewTypeParentId}
              typeFormError={typeFormError}
              savingType={savingType}
              onCreateType={() => void onCreateType()}
            />
          </section>

          <section className="lookup-admin-page__panel" aria-labelledby="lookup-types-catalog-heading">
            <h2 id="lookup-types-catalog-heading" className="lookup-admin-page__panel-title">
              Registered types ({types.length})
            </h2>
            <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
              Types are tenant-scoped in Commerce.Api. Use <strong>Manage values</strong> to add or delete rows for a type.
            </p>
            <div className="lookup-admin-page__types-table-wrap">
              <table className="lookup-admin-page__types-table">
                <thead>
                  <tr>
                    <th scope="col">Type id</th>
                    <th scope="col">Title</th>
                    <th scope="col">Parent type</th>
                    <th scope="col" className="lookup-admin-page__types-table-actions">
                      <span className="lookup-admin-page__sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((t) => {
                    const parentLabel = t.parentLookupTypeId
                      ? (types.find((x) => x.id === t.parentLookupTypeId)?.title ?? t.parentLookupTypeId)
                      : "—";
                    return (
                      <tr key={t.id}>
                        <td>
                          <code className="lookup-admin-page__types-code">{t.id}</code>
                        </td>
                        <td>{t.title}</td>
                        <td className="lookup-admin-page__types-muted">{parentLabel}</td>
                        <td className="lookup-admin-page__types-table-actions">
                          <button
                            type="button"
                            className="shell-btn shell-btn--ghost"
                            onClick={() => {
                              setSelectedTypeId(t.id);
                              setFormError(null);
                              setFormResetKey((k) => k + 1);
                              setAdminSection("values");
                            }}
                          >
                            Manage values
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {adminSection === "values" ? (
        <div
          id="lookup-admin-panel-values"
          role="tabpanel"
          aria-labelledby="lookup-admin-tab-values"
          className="lookup-admin-page__tab-panel"
        >
          <div className="lookup-admin-page__toolbar">
            <label className="lookup-admin-page__field">
              <span className="lookup-admin-page__label">Lookup</span>
              <select
                className="lookup-admin-page__select"
                value={selectedTypeId}
                onChange={(e) => {
                  setSelectedTypeId(e.target.value);
                  setFormError(null);
                  setFormResetKey((k) => k + 1);
                }}
                aria-label="Select lookup type"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            {selectedDto.description ? <p className="lookup-admin-page__hint">{selectedDto.description}</p> : null}
            <button type="button" className="shell-btn shell-btn--outline lookup-admin-page__toolbar-link" onClick={() => setAdminSection("types")}>
              New type…
            </button>
          </div>

          {selectedDto.parentLookupTypeId && parentRows.length === 0 ? (
            <p className="lookup-admin-page__warn" role="status">
              Add at least one row in <strong>{parentTypeTitle}</strong> before you can pick a parent here.
            </p>
          ) : null}

          <div className="lookup-admin-page__grid">
            <section className="lookup-admin-page__panel" aria-labelledby="lookup-add-heading">
              <h2 id="lookup-add-heading" className="lookup-admin-page__panel-title">
                Add entry — {selectedDto.title}
              </h2>
              {formError ? (
                <p className="lookup-admin-page__form-error" role="alert">
                  {formError}
                </p>
              ) : null}
              <JsonForm
                key={selectedDto.id}
                form={entryForm}
                className="lookup-admin-page__form"
                resetKey={formResetKey}
                onSubmit={onAdd}
              >
                <div className="lookup-admin-page__form-actions">
                  <button type="submit" className="shell-btn shell-btn--primary" disabled={!token}>
                    Save entry
                  </button>
                </div>
              </JsonForm>
            </section>

            <section className="lookup-admin-page__panel" aria-labelledby="lookup-list-heading">
              <h2 id="lookup-list-heading" className="lookup-admin-page__panel-title">
                Current values
              </h2>
              {listsLoading ? (
                <p className="lookup-admin-page__empty">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="lookup-admin-page__empty">No rows yet for this lookup.</p>
              ) : (
                <ul className="lookup-admin-page__list">
                  {entries.map((e) => (
                    <li key={e.id} className="lookup-admin-page__list-row">
                      <div className="lookup-admin-page__list-main">
                        <span className="lookup-admin-page__code">{e.code}</span>
                        <span className="lookup-admin-page__label-text">{e.label}</span>
                        {e.parentValueId ? (
                          <span className="lookup-admin-page__parent">
                            {selectedDto.parentFieldLabel ?? "Parent"}:{" "}
                            {parentRows.find((p) => p.id === e.parentValueId)?.label ?? e.parentValueId}
                          </span>
                        ) : null}
                        <span className="lookup-admin-page__sort">Sort {e.sortOrder}</span>
                      </div>
                      <button
                        type="button"
                        className="shell-btn shell-btn--ghost lookup-admin-page__delete"
                        disabled={!token}
                        onClick={() => void onDelete(e)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      <footer className="lookup-admin-page__footer">
        <p className="lookup-admin-page__registry-note">
          API: <code>GET /api/v1/lookups/types</code>, <code>GET …/types/&#123;id&#125;/values</code>; mutating routes require{" "}
          <code>Authorization: Bearer …</code>. Optional dev seed: <code>CommerceDevDataSeeder</code>.
        </p>
        <Link to="/">← Home</Link>
      </footer>
    </div>
  );
}

function LookupNewTypeSection(props: {
  types: CommerceLookupTypeDto[];
  canMutate: boolean;
  newTypeId: string;
  setNewTypeId: (v: string) => void;
  newTypeTitle: string;
  setNewTypeTitle: (v: string) => void;
  newTypePrefix: string;
  setNewTypePrefix: (v: string) => void;
  newTypeParentId: string;
  setNewTypeParentId: (v: string) => void;
  typeFormError: string | null;
  savingType: boolean;
  onCreateType: () => void;
}) {
  const {
    types,
    canMutate,
    newTypeId,
    setNewTypeId,
    newTypeTitle,
    setNewTypeTitle,
    newTypePrefix,
    setNewTypePrefix,
    newTypeParentId,
    setNewTypeParentId,
    typeFormError,
    savingType,
    onCreateType,
  } = props;

  return (
    <div className="lookup-admin-page__new-type">
      {typeFormError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {typeFormError}
        </p>
      ) : null}
      <div className="lookup-admin-page__new-type-grid">
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Type id</span>
          <input
            className="lookup-admin-page__select"
            value={newTypeId}
            onChange={(e) => setNewTypeId(e.target.value)}
            placeholder="e.g. fabric_types"
            autoComplete="off"
          />
        </label>
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Title</span>
          <input
            className="lookup-admin-page__select"
            value={newTypeTitle}
            onChange={(e) => setNewTypeTitle(e.target.value)}
            placeholder="Display title"
          />
        </label>
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Entry id prefix</span>
          <input
            className="lookup-admin-page__select"
            value={newTypePrefix}
            onChange={(e) => setNewTypePrefix(e.target.value)}
            placeholder="e.g. fab_"
            maxLength={32}
          />
        </label>
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Parent type (optional)</span>
          <select
            className="lookup-admin-page__select"
            value={newTypeParentId}
            onChange={(e) => setNewTypeParentId(e.target.value)}
            aria-label="Parent lookup type"
          >
            <option value="">— None (root lookup) —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.id})
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="lookup-admin-page__form-actions">
        <button
          type="button"
          className="shell-btn shell-btn--outline"
          onClick={onCreateType}
          disabled={savingType || !canMutate}
        >
          {savingType ? "Saving…" : "Create lookup type"}
        </button>
      </div>
    </div>
  );
}
