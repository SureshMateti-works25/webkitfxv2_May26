import { getAtPath } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupCategoryImageFormBinding, LookupCategoryImageUploadControl } from "../components/LookupCategoryImageUpload.js";
import { buildLookupEntryFormDefinition } from "../lib/buildLookupEntryForm.js";
import { commerceLookupTypeToTypeDef } from "../lib/commerceLookupMappers.js";
import {
  createCommerceLookupValue,
  deleteCommerceLookupType,
  deleteCommerceLookupValue,
  formatCommerceApiError,
  listCommerceLookupTypes,
  listCommerceLookupValues,
  updateCommerceLookupValue,
  upsertCommerceLookupType,
  type CommerceLookupTypeDto,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";

type LookupAdminSection = "types" | "values";

export function LookupAdminPage() {
  const { getAccessToken, auth } = useAuth();
  const token = getAccessToken();
  const canUploadCategoryImage =
    auth.status === "signedIn" && (auth.role === "vendor" || auth.role === "admin");

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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [valuesSearchQuery, setValuesSearchQuery] = useState("");
  const [typesSearchQuery, setTypesSearchQuery] = useState("");
  const [showAddEntryForm, setShowAddEntryForm] = useState(false);
  const valueRowRefs = useRef(new Map<string, HTMLLIElement>());
  const [typeFormError, setTypeFormError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [newTypeId, setNewTypeId] = useState("");
  const [newTypeTitle, setNewTypeTitle] = useState("");
  const [newTypePrefix, setNewTypePrefix] = useState("lk_");
  const [newTypeParentId, setNewTypeParentId] = useState("");
  const [adminSection, setAdminSection] = useState<LookupAdminSection>("values");

  const [showNewTypeForm, setShowNewTypeForm] = useState(false);
  const [showEditTypeForm, setShowEditTypeForm] = useState(false);
  const [typesPanelError, setTypesPanelError] = useState<string | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  const [editTargetTypeId, setEditTargetTypeId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrefix, setEditPrefix] = useState("");
  const [editParentTypeId, setEditParentTypeId] = useState("");
  const [editParentLabel, setEditParentLabel] = useState("");
  const [savingEditType, setSavingEditType] = useState(false);
  const [editTypeFormError, setEditTypeFormError] = useState<string | null>(null);

  useEffect(() => {
    if (adminSection !== "types") {
      setShowNewTypeForm(false);
      setShowEditTypeForm(false);
      setTypesPanelError(null);
    }
  }, [adminSection]);

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
    if (types.length === 0) return;
    setEditTargetTypeId((prev) => {
      if (prev && types.some((t) => t.id === prev)) return prev;
      return types.find((t) => t.id === "product_categories")?.id ?? types[0]!.id;
    });
  }, [types]);

  useEffect(() => {
    if (!editTargetTypeId) return;
    const t = types.find((x) => x.id === editTargetTypeId);
    if (!t) return;
    setEditTitle(t.title);
    setEditDescription(t.description ?? "");
    setEditPrefix(t.entryIdPrefix);
    setEditParentTypeId(t.parentLookupTypeId ?? "");
    setEditParentLabel(t.parentFieldLabel ?? "");
  }, [editTargetTypeId, types]);

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

  useEffect(() => {
    setEditingEntryId(null);
    setValuesSearchQuery("");
    setShowAddEntryForm(false);
  }, [selectedTypeId]);

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

  const filteredTypes = useMemo(() => {
    const q = typesSearchQuery.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) => {
      if (t.id.toLowerCase().includes(q)) return true;
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.description?.toLowerCase().includes(q)) return true;
      if (t.parentLookupTypeId?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [types, typesSearchQuery]);

  /** Types with no `parentLookupTypeId` — value rows cannot attach to a parent lookup until set. */
  const typesMissingParentLookup = useMemo(
    () => types.filter((t) => !t.parentLookupTypeId?.trim()),
    [types]
  );

  const filteredEntries = useMemo(() => {
    if (editingEntryId) return entries;
    const q = valuesSearchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.code.toLowerCase().includes(q)) return true;
      if (e.label.toLowerCase().includes(q)) return true;
      if (e.id.toLowerCase().includes(q)) return true;
      if (String(e.sortOrder).includes(q)) return true;
      if (e.parentValueId) {
        const pl = parentRows.find((p) => p.id === e.parentValueId)?.label ?? "";
        if (pl.toLowerCase().includes(q)) return true;
        if (e.parentValueId.toLowerCase().includes(q)) return true;
      }
      if (e.imageStorageKey?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [entries, valuesSearchQuery, editingEntryId, parentRows]);

  useEffect(() => {
    if (!editingEntryId) return;
    const id = editingEntryId;
    requestAnimationFrame(() => {
      const el = valueRowRefs.current.get(id);
      if (!el) return;
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    });
  }, [editingEntryId]);

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
      const imageRaw =
        selectedDto.id === "product_categories"
          ? String(getAtPath(values, "entry.storefrontImageKey") ?? "").trim()
          : "";
      const imageStorageKey = imageRaw.length > 0 ? imageRaw : null;

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
          imageStorageKey,
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

  const onSaveEntry = useCallback(
    async (
      valueId: string,
      body: {
        code: string;
        label: string;
        sortOrder: number;
        parentValueId: string | null;
        imageStorageKey: string | null;
      }
    ) => {
      if (!token) {
        setFormError("Sign in to edit lookup values.");
        return;
      }
      setFormError(null);
      try {
        await updateCommerceLookupValue(token, valueId, body);
        setEditingEntryId(null);
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
      setShowNewTypeForm(false);
      setTypesPanelError(null);
    } catch (e) {
      setTypeFormError(formatCommerceApiError(e));
    } finally {
      setSavingType(false);
    }
  };

  const onSaveEditType = async () => {
    setEditTypeFormError(null);
    if (!token) {
      setEditTypeFormError("Sign in to edit lookup types.");
      return;
    }
    const typeId = editTargetTypeId.trim();
    const row = types.find((x) => x.id === typeId);
    if (!row) {
      setEditTypeFormError("Select a valid lookup type.");
      return;
    }
    const title = editTitle.trim();
    if (!title) {
      setEditTypeFormError("Title is required.");
      return;
    }
    const prefix = editPrefix.trim() || "lk_";
    if (prefix.length < 1 || prefix.length > 32) {
      setEditTypeFormError("Entry id prefix: 1–32 characters.");
      return;
    }
    const parent = editParentTypeId.trim();
    if (parent && parent === typeId) {
      setEditTypeFormError("Parent lookup type cannot be the same as this type’s id.");
      return;
    }
    const parentLabelTrimmed = editParentLabel.trim();
    setSavingEditType(true);
    try {
      await upsertCommerceLookupType(token, typeId, {
        title,
        description: editDescription.trim() ? editDescription.trim() : null,
        parentLookupTypeId: parent || null,
        parentFieldLabel: parent ? (parentLabelTrimmed || null) : null,
        entryIdPrefix: prefix,
      });
      const t = await listCommerceLookupTypes();
      setTypes([...t].sort((a, b) => a.id.localeCompare(b.id)));
      setShowEditTypeForm(false);
      setTypesPanelError(null);
    } catch (e) {
      setEditTypeFormError(formatCommerceApiError(e));
    } finally {
      setSavingEditType(false);
    }
  };

  const onDeleteType = async (row: CommerceLookupTypeDto) => {
    setTypesPanelError(null);
    if (!token) {
      setTypesPanelError("Sign in to delete lookup types.");
      return;
    }
    const ok = window.confirm(
      `Delete lookup type “${row.title}” (${row.id})?\n\nThis removes the type and all of its values. This cannot be undone.`
    );
    if (!ok) return;
    setDeletingTypeId(row.id);
    try {
      await deleteCommerceLookupType(token, row.id);
      const t = await listCommerceLookupTypes();
      const sorted = [...t].sort((a, b) => a.id.localeCompare(b.id));
      setTypes(sorted);
      setListVersion((v) => v + 1);
      setShowEditTypeForm(false);
      setShowNewTypeForm(false);
      if (editTargetTypeId === row.id) {
        setEditTargetTypeId(sorted[0]?.id ?? "");
      }
      if (selectedTypeId === row.id) {
        setSelectedTypeId(sorted[0]?.id ?? "");
      }
    } catch (e) {
      setTypesPanelError(formatCommerceApiError(e));
    } finally {
      setDeletingTypeId(null);
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
          {typesPanelError ? (
            <p className="lookup-admin-page__form-error" role="alert">
              {typesPanelError}
            </p>
          ) : null}

          <div
            className={
              showNewTypeForm || showEditTypeForm
                ? "lookup-admin-page__grid"
                : "lookup-admin-page__values-layout-list-only"
            }
          >
            {showNewTypeForm ? (
              <section
                id="lookup-new-type-panel"
                className="lookup-admin-page__panel lookup-admin-page__panel--compact"
                aria-labelledby="lookup-new-type-heading"
              >
                <div className="lookup-admin-page__values-toolbar">
                  <h2 id="lookup-new-type-heading" className="lookup-admin-page__panel-title lookup-admin-page__panel-title--inline">
                    New lookup type
                  </h2>
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline"
                    onClick={() => {
                      setShowNewTypeForm(false);
                      setTypeFormError(null);
                    }}
                  >
                    Close
                  </button>
                </div>
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
            ) : null}

            {showEditTypeForm ? (
              <section
                id="lookup-edit-type-panel"
                className="lookup-admin-page__panel"
                aria-labelledby="lookup-edit-type-heading"
              >
                <div className="lookup-admin-page__values-toolbar">
                  <h2 id="lookup-edit-type-heading" className="lookup-admin-page__panel-title lookup-admin-page__panel-title--inline">
                    Edit lookup type
                  </h2>
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline"
                    onClick={() => {
                      setShowEditTypeForm(false);
                      setEditTypeFormError(null);
                    }}
                  >
                    Close
                  </button>
                </div>
                <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
                  Type id <code>{editTargetTypeId}</code> cannot be changed. Value rows are under <strong>Lookup values</strong>.
                </p>
                {editTypeFormError ? (
                  <p className="lookup-admin-page__form-error" role="alert">
                    {editTypeFormError}
                  </p>
                ) : null}
                <div className="lookup-admin-page__new-type-grid">
                  <label className="lookup-admin-page__field">
                    <span className="lookup-admin-page__label">Title</span>
                    <input
                      className="lookup-admin-page__select"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label className="lookup-admin-page__field lookup-admin-page__field--span">
                    <span className="lookup-admin-page__label">Description (optional)</span>
                    <textarea
                      className="lookup-admin-page__select lookup-admin-page__textarea"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      aria-label="Lookup type description"
                    />
                  </label>
                  <label className="lookup-admin-page__field">
                    <span className="lookup-admin-page__label">Entry id prefix</span>
                    <input
                      className="lookup-admin-page__select"
                      value={editPrefix}
                      onChange={(e) => setEditPrefix(e.target.value)}
                      maxLength={32}
                      autoComplete="off"
                    />
                  </label>
                  <label className="lookup-admin-page__field">
                    <span className="lookup-admin-page__label">Parent type (optional)</span>
                    <select
                      className="lookup-admin-page__select"
                      value={editParentTypeId}
                      onChange={(e) => setEditParentTypeId(e.target.value)}
                      aria-label="Parent lookup type"
                    >
                      <option value="">(none)</option>
                      {types
                        .filter((x) => x.id !== editTargetTypeId)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title} ({x.id})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="lookup-admin-page__field">
                    <span className="lookup-admin-page__label">Parent field label</span>
                    <input
                      className="lookup-admin-page__select"
                      value={editParentLabel}
                      onChange={(e) => setEditParentLabel(e.target.value)}
                      placeholder={editParentTypeId ? "e.g. Product type" : "—"}
                      disabled={!editParentTypeId}
                      autoComplete="off"
                      aria-label="Label shown for parent selector on values"
                    />
                  </label>
                </div>
                <div className="lookup-admin-page__form-actions">
                  <button
                    type="button"
                    className="shell-btn shell-btn--primary"
                    disabled={!token || savingEditType}
                    onClick={() => void onSaveEditType()}
                  >
                    {savingEditType ? "Saving…" : "Save type"}
                  </button>
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline"
                    disabled={savingEditType}
                    onClick={() => {
                      setShowEditTypeForm(false);
                      setEditTypeFormError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}

            <section className="lookup-admin-page__panel" aria-labelledby="lookup-types-catalog-heading">
              <div className="lookup-admin-page__values-toolbar">
                <h2 id="lookup-types-catalog-heading" className="lookup-admin-page__panel-title lookup-admin-page__panel-title--inline">
                  Lookup types ({types.length})
                </h2>
                <div className="lookup-admin-page__values-toolbar-controls">
                  {types.length > 0 ? (
                    <div className="lookup-admin-page__search-field">
                      <label htmlFor="lookup-types-search" className="lookup-admin-page__sr-only">
                        Filter lookup types
                      </label>
                      <input
                        id="lookup-types-search"
                        type="search"
                        className="lookup-admin-page__select lookup-admin-page__search-input"
                        value={typesSearchQuery}
                        onChange={(e) => setTypesSearchQuery(e.target.value)}
                        placeholder="Search types by id, title…"
                        autoComplete="off"
                        spellCheck={false}
                        aria-controls="lookup-types-table-body"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline lookup-admin-page__add-lookup-btn"
                    disabled={!token}
                    aria-expanded={showNewTypeForm}
                    aria-controls={showNewTypeForm ? "lookup-new-type-panel" : undefined}
                    onClick={() => {
                      setTypesPanelError(null);
                      setShowEditTypeForm(false);
                      setEditTypeFormError(null);
                      setShowNewTypeForm((prev) => !prev);
                    }}
                  >
                    {showNewTypeForm ? "Close add type" : "Add type"}
                  </button>
                </div>
              </div>
              {typesSearchQuery.trim() && types.length > 0 ? (
                <p className="lookup-admin-page__filter-meta" role="status">
                  Showing {filteredTypes.length} of {types.length} types
                </p>
              ) : null}
              <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
                Tenant-scoped in Commerce.Api. <strong>Delete</strong> removes the type and all of its values. Manage rows under{" "}
                <strong>Lookup values</strong>. Dependent lookups must set <code>parentLookupTypeId</code> on the type so
                each value can set <code>parentValueId</code>.
              </p>
              {typesMissingParentLookup.length > 0 ? (
                <p className="lookup-admin-page__warn lookup-admin-page__hint--block" role="status">
                  <strong>{typesMissingParentLookup.length}</strong> of {types.length} lookup{" "}
                  {types.length === 1 ? "type has" : "types have"} no <code>parentLookupTypeId</code>
                  {typesMissingParentLookup.length <= 14
                    ? `: ${typesMissingParentLookup.map((t) => t.id).join(", ")}.`
                    : `: ${typesMissingParentLookup
                        .slice(0, 14)
                        .map((t) => t.id)
                        .join(", ")}, and ${typesMissingParentLookup.length - 14} more.`}{" "}
                  Use <strong>Edit</strong> on each type and choose a <strong>Parent type</strong> when this lookup&apos;s
                  values should link to another lookup.
                </p>
              ) : null}
              <div className="lookup-admin-page__types-table-wrap lookup-admin-page__types-table-wrap--scroll">
                <table className="lookup-admin-page__types-table">
                  <thead>
                    <tr>
                      <th scope="col">Type id</th>
                      <th scope="col">Title</th>
                      <th scope="col">Parent linkage</th>
                      <th scope="col" className="lookup-admin-page__types-table-actions">
                        <span className="lookup-admin-page__sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="lookup-types-table-body">
                    {filteredTypes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="lookup-admin-page__types-empty">
                          {types.length === 0
                            ? "No lookup types yet. Use Add type to create one."
                            : "No types match your filter."}
                        </td>
                      </tr>
                    ) : (
                      filteredTypes.map((t) => {
                        const hasParent = Boolean(t.parentLookupTypeId?.trim());
                        const parentId = t.parentLookupTypeId?.trim() ?? "";
                        const parentTitle = hasParent
                          ? (types.find((x) => x.id === parentId)?.title ?? null)
                          : null;
                        return (
                          <tr key={t.id}>
                            <td>
                              <code className="lookup-admin-page__types-code">{t.id}</code>
                            </td>
                            <td>{t.title}</td>
                            <td className="lookup-admin-page__types-parent-cell">
                              <div className="lookup-admin-page__parent-status">
                                <span
                                  className={
                                    hasParent
                                      ? "lookup-admin-page__parent-badge lookup-admin-page__parent-badge--set"
                                      : "lookup-admin-page__parent-badge lookup-admin-page__parent-badge--none"
                                  }
                                >
                                  {hasParent ? "Parent set" : "No parent type"}
                                </span>
                              </div>
                              {hasParent ? (
                                <span className="lookup-admin-page__parent-detail">
                                  <code>{parentId}</code>
                                  {parentTitle && parentTitle !== parentId ? ` · ${parentTitle}` : null}
                                </span>
                              ) : (
                                <span className="lookup-admin-page__parent-detail lookup-admin-page__types-muted">
                                  <code>parentLookupTypeId</code> is empty — value rows have no parent lookup.
                                </span>
                              )}
                            </td>
                            <td className="lookup-admin-page__types-table-actions">
                              <div className="lookup-admin-page__types-table-actions-inner">
                                <button
                                  type="button"
                                  className="shell-btn shell-btn--ghost"
                                  disabled={!!deletingTypeId}
                                  onClick={() => {
                                    setTypesPanelError(null);
                                    setShowNewTypeForm(false);
                                    setTypeFormError(null);
                                    setEditTargetTypeId(t.id);
                                    setEditTypeFormError(null);
                                    setShowEditTypeForm(true);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="shell-btn shell-btn--ghost lookup-admin-page__delete"
                                  disabled={!token || deletingTypeId !== null}
                                  aria-busy={deletingTypeId === t.id}
                                  onClick={() => void onDeleteType(t)}
                                >
                                  {deletingTypeId === t.id ? "Deleting…" : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
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
                    {t.parentLookupTypeId?.trim() ? "" : " · no parent type"}
                  </option>
                ))}
              </select>
            </label>
            {selectedDto.description ? <p className="lookup-admin-page__hint">{selectedDto.description}</p> : null}
            <p className="lookup-admin-page__hint lookup-admin-page__hint--block" role="status">
              {selectedDto.parentLookupTypeId?.trim() ? (
                <>
                  <span className="lookup-admin-page__parent-badge lookup-admin-page__parent-badge--set">Parent set</span>{" "}
                  This lookup&apos;s type declares <code>parentLookupTypeId</code> ={" "}
                  <code>{selectedDto.parentLookupTypeId.trim()}</code>
                  {parentTypeTitle && parentTypeTitle !== selectedDto.parentLookupTypeId.trim()
                    ? ` (${parentTypeTitle})`
                    : ""}
                  . Value rows should set <strong>{selectedDto.parentFieldLabel ?? "Parent"}</strong> when entries depend
                  on that type.
                </>
              ) : (
                <>
                  <span className="lookup-admin-page__parent-badge lookup-admin-page__parent-badge--none">No parent type</span>{" "}
                  This lookup&apos;s type has no <code>parentLookupTypeId</code>. Add/edit value forms will not show a
                  parent row selector; values are standalone.
                </>
              )}
            </p>
            <button type="button" className="shell-btn shell-btn--outline lookup-admin-page__toolbar-link" onClick={() => setAdminSection("types")}>
              New type…
            </button>
          </div>

          {selectedDto.parentLookupTypeId && parentRows.length === 0 ? (
            <p className="lookup-admin-page__warn" role="status">
              Add at least one row in <strong>{parentTypeTitle}</strong> before you can pick a parent here.
            </p>
          ) : null}

          <div
            className={
              showAddEntryForm ? "lookup-admin-page__grid" : "lookup-admin-page__values-layout-list-only"
            }
          >
            {showAddEntryForm ? (
              <section
                id="lookup-add-panel"
                className="lookup-admin-page__panel"
                aria-labelledby="lookup-add-heading"
              >
                <h2 id="lookup-add-heading" className="lookup-admin-page__panel-title">
                  Add entry — {selectedDto.title}
                </h2>
                {formError ? (
                  <p className="lookup-admin-page__form-error" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className="lookup-admin-page__form-actions lookup-admin-page__form-actions--top">
                  <button
                    type="submit"
                    form="lookup-admin-add-entry-form"
                    className="shell-btn shell-btn--primary"
                    disabled={!token}
                  >
                    Save entry
                  </button>
                </div>
                <JsonForm
                  id="lookup-admin-add-entry-form"
                  key={selectedDto.id}
                  form={entryForm}
                  className="lookup-admin-page__form"
                  resetKey={formResetKey}
                  onSubmit={onAdd}
                >
                  {selectedDto.id === "product_categories" ? (
                    <div className="lookup-admin-page__field lookup-admin-page__field--span">
                      <span className="lookup-admin-page__label">Category image (storefront tile)</span>
                      <LookupCategoryImageFormBinding accessToken={token} canUpload={canUploadCategoryImage} />
                    </div>
                  ) : null}
                </JsonForm>
              </section>
            ) : null}

            <section className="lookup-admin-page__panel" aria-labelledby="lookup-list-heading">
              <div className="lookup-admin-page__values-toolbar">
                <h2 id="lookup-list-heading" className="lookup-admin-page__panel-title lookup-admin-page__panel-title--inline">
                  Current values
                </h2>
                <div className="lookup-admin-page__values-toolbar-controls">
                  {!listsLoading && entries.length > 0 ? (
                    <div className="lookup-admin-page__search-field">
                      <label htmlFor="lookup-values-search" className="lookup-admin-page__sr-only">
                        Filter lookup values
                      </label>
                      <input
                        id="lookup-values-search"
                        type="search"
                        className="lookup-admin-page__select lookup-admin-page__search-input"
                        value={valuesSearchQuery}
                        onChange={(e) => setValuesSearchQuery(e.target.value)}
                        placeholder="Search code, label, id, parent…"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={!!editingEntryId}
                        title={editingEntryId ? "Clear edit mode to filter again" : undefined}
                        aria-controls="lookup-values-list"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="shell-btn shell-btn--outline lookup-admin-page__add-lookup-btn"
                    disabled={!token}
                    aria-expanded={showAddEntryForm}
                    aria-controls={showAddEntryForm ? "lookup-add-panel" : undefined}
                    onClick={() => {
                      setShowAddEntryForm((prev) => {
                        const next = !prev;
                        if (!next) {
                          setFormError(null);
                          setFormResetKey((k) => k + 1);
                        }
                        return next;
                      });
                    }}
                  >
                    {showAddEntryForm ? "Close add form" : "Add lookup"}
                  </button>
                </div>
              </div>
              {valuesSearchQuery.trim() && !listsLoading && entries.length > 0 && !editingEntryId ? (
                <p className="lookup-admin-page__filter-meta" role="status">
                  Showing {filteredEntries.length} of {entries.length} rows
                  {filteredEntries.length === 0 ? " — try a different search." : null}
                </p>
              ) : null}
              {editingEntryId ? (
                <p className="lookup-admin-page__filter-meta" role="status">
                  Filter is paused while you edit. Save or cancel to search again.
                </p>
              ) : null}
              {listsLoading ? (
                <p className="lookup-admin-page__empty">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="lookup-admin-page__empty">No rows yet for this lookup.</p>
              ) : filteredEntries.length === 0 ? (
                <p className="lookup-admin-page__empty" role="status">
                  No rows match your filter. Clear the search box to see all values.
                </p>
              ) : (
                <ul id="lookup-values-list" className="lookup-admin-page__list lookup-admin-page__list--scroll">
                  {filteredEntries.map((e) => (
                    <li
                      key={e.id}
                      className="lookup-admin-page__list-row"
                      ref={(node) => {
                        if (node) valueRowRefs.current.set(e.id, node);
                        else valueRowRefs.current.delete(e.id);
                      }}
                    >
                      {editingEntryId === e.id ? (
                        <LookupValueEditRow
                          key={e.id}
                          entry={e}
                          accessToken={token}
                          canUploadCategoryImage={canUploadCategoryImage}
                          parentOptions={parentOptions}
                          parentRequired={!!selectedDto.parentLookupTypeId}
                          parentLabel={selectedDto.parentFieldLabel ?? parentTypeTitle ?? "Parent"}
                          showStorefrontImage={selectedDto.id === "product_categories"}
                          onCancel={() => {
                            setEditingEntryId(null);
                            setFormError(null);
                          }}
                          onSave={(body) => onSaveEntry(e.id, body)}
                        />
                      ) : (
                        <>
                          <div className="lookup-admin-page__list-main">
                            <span className="lookup-admin-page__code">{e.code}</span>
                            <span className="lookup-admin-page__label-text">{e.label}</span>
                            {selectedDto.parentLookupTypeId ? (
                              <span className="lookup-admin-page__parent">
                                {selectedDto.parentFieldLabel ?? "Parent"}:{" "}
                                {e.parentValueId
                                  ? parentRows.find((p) => p.id === e.parentValueId)?.label ?? e.parentValueId
                                  : "(not set)"}
                              </span>
                            ) : null}
                            <span className="lookup-admin-page__sort">Sort {e.sortOrder}</span>
                            {(() => {
                              const isCategories = selectedDto.id === "product_categories";
                              const hasImg =
                                typeof e.imageStorageKey === "string" &&
                                e.imageStorageKey.trim().length > 0;
                              const key = hasImg ? e.imageStorageKey.trim() : "";
                              if (!isCategories) {
                                return (
                                  <span
                                    className="lookup-admin-page__thumb-hint lookup-admin-page__thumb-hint--na"
                                    title="Storefront image is only used for the product categories lookup"
                                    aria-label="Storefront image not used for this lookup type"
                                  >
                                    Image · n/a
                                  </span>
                                );
                              }
                              return (
                                <span
                                  className={
                                    hasImg
                                      ? "lookup-admin-page__thumb-hint lookup-admin-page__thumb-hint--set"
                                      : "lookup-admin-page__thumb-hint lookup-admin-page__thumb-hint--empty"
                                  }
                                  title={hasImg ? key : "No storefront image for this category"}
                                  aria-label={
                                    hasImg
                                      ? `Storefront image is set (${key})`
                                      : "No storefront image for this category"
                                  }
                                >
                                  {hasImg ? "Image · yes" : "Image · no"}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="lookup-admin-page__list-actions">
                            <button
                              type="button"
                              className="shell-btn shell-btn--ghost"
                              disabled={!token}
                              onClick={() => {
                                setEditingEntryId(e.id);
                                setFormError(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="shell-btn shell-btn--ghost lookup-admin-page__delete"
                              disabled={!token}
                              onClick={() => void onDelete(e)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
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
          API: <code>GET /api/v1/lookups/types</code>, <code>GET …/types/&#123;id&#125;/values</code>,{" "}
          <code>PUT /api/v1/lookups/values/&#123;valueId&#125;</code> (edit row); mutating routes require{" "}
          <code>Authorization: Bearer …</code>. Optional dev seed: <code>CommerceDevDataSeeder</code>.
        </p>
        <Link to="/">← Home</Link>
      </footer>
    </div>
  );
}

function LookupValueEditRow({
  entry,
  accessToken,
  canUploadCategoryImage,
  parentOptions,
  parentRequired,
  parentLabel,
  showStorefrontImage,
  onCancel,
  onSave,
}: {
  entry: CommerceLookupValueDto;
  accessToken: string | null;
  canUploadCategoryImage: boolean;
  parentOptions: { value: string; label: string }[];
  parentRequired: boolean;
  parentLabel: string;
  showStorefrontImage: boolean;
  onCancel: () => void;
  onSave: (body: {
    code: string;
    label: string;
    sortOrder: number;
    parentValueId: string | null;
    imageStorageKey: string | null;
  }) => Promise<void>;
}) {
  const normalizedImageKey =
    typeof entry.imageStorageKey === "string" && entry.imageStorageKey.trim().length > 0
      ? entry.imageStorageKey.trim()
      : "";

  const [code, setCode] = useState(entry.code);
  const [label, setLabel] = useState(entry.label);
  const [sortOrder, setSortOrder] = useState(String(entry.sortOrder));
  const [parentValueId, setParentValueId] = useState(entry.parentValueId ?? "");
  const [imageStorageKey, setImageStorageKey] = useState(normalizedImageKey);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setCode(entry.code);
    setLabel(entry.label);
    setSortOrder(String(entry.sortOrder));
    setParentValueId(entry.parentValueId ?? "");
    const nextImg =
      typeof entry.imageStorageKey === "string" && entry.imageStorageKey.trim().length > 0
        ? entry.imageStorageKey.trim()
        : "";
    setImageStorageKey(nextImg);
    setLocalError(null);
  }, [entry.id, entry.code, entry.label, entry.sortOrder, entry.parentValueId, entry.imageStorageKey]);

  const submit = async () => {
    setLocalError(null);
    const so = Math.trunc(Number(sortOrder));
    const c = code.trim().toLowerCase();
    const lb = label.trim();
    const pid = parentValueId.trim();
    if (!c || !lb) {
      setLocalError("Code and label are required.");
      return;
    }
    if (!Number.isFinite(so) || so < 0) {
      setLocalError("Sort order must be a non-negative integer.");
      return;
    }
    if (parentRequired && !pid) {
      setLocalError(`Choose ${parentLabel}.`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        code: c,
        label: lb,
        sortOrder: so,
        parentValueId: parentRequired ? pid : null,
        imageStorageKey: showStorefrontImage ? (imageStorageKey.trim() || null) : entry.imageStorageKey ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lookup-admin-page__value-edit">
      {localError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="lookup-admin-page__value-edit-actions lookup-admin-page__value-edit-actions--sticky">
        <button type="button" className="shell-btn shell-btn--primary" disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="shell-btn shell-btn--outline" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="lookup-admin-page__value-edit-grid">
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Code</span>
          <input className="lookup-admin-page__select" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Label</span>
          <input className="lookup-admin-page__select" value={label} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
        </label>
        {parentRequired ? (
          <label className="lookup-admin-page__field lookup-admin-page__field--span">
            <span className="lookup-admin-page__label">{parentLabel}</span>
            <select
              className="lookup-admin-page__select"
              value={parentValueId}
              onChange={(e) => setParentValueId(e.target.value)}
              aria-label={parentLabel}
            >
              <option value="">Select…</option>
              {parentOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="lookup-admin-page__field">
          <span className="lookup-admin-page__label">Sort order</span>
          <input
            className="lookup-admin-page__select"
            type="number"
            min={0}
            step={1}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </label>
        {showStorefrontImage ? (
          <>
            <div className="lookup-admin-page__field lookup-admin-page__field--span">
              <span className="lookup-admin-page__label">Category image</span>
              <LookupCategoryImageUploadControl
                accessToken={accessToken}
                canUpload={canUploadCategoryImage}
                storageKey={imageStorageKey}
                onStorageKeyChange={setImageStorageKey}
              />
            </div>
            <details className="lookup-admin-page__details">
              <summary className="lookup-admin-page__details-summary">Advanced: paste storage key</summary>
              <label className="lookup-admin-page__field lookup-admin-page__field--span">
                <span className="lookup-admin-page__label">Image key (internal)</span>
                <input
                  className="lookup-admin-page__select"
                  value={imageStorageKey}
                  onChange={(e) => setImageStorageKey(e.target.value)}
                  placeholder="Only if support gave you a key"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </details>
          </>
        ) : null}
      </div>
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
