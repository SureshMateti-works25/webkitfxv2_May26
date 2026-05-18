import { getAtPath } from "@webkitfxv2/core-engine";
import type { FormDefinition } from "@webkitfxv2/core-engine";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { LookupEntryFormActions } from "../components/LookupEntryFormActions.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import { getTableManagementWorkspace } from "../config/getTableManagementWorkspace.js";
import { getForm } from "../config/forms/index.js";
import {
  createCommerceLookupValue,
  deleteCommerceLookupValue,
  formatCommerceApiError,
  listCommerceLookupValues,
  updateCommerceLookupValue,
  type CommerceLookupValueDto,
} from "../lib/commerceApi.js";

const SECTION_FORM_ID = "lookup-table-section-add";
const TABLE_FORM_ID = "lookup-table-add";

function mergeSectionSelectOptions(
  form: FormDefinition,
  sections: CommerceLookupValueDto[]
): FormDefinition {
  const options = sections.map((s) => ({
    value: s.id,
    label: `${s.label} (${s.code})`,
  }));
  const sectionField = form.fields.sectionId;
  if (!sectionField) return form;
  return {
    ...form,
    fields: {
      ...form.fields,
      sectionId: {
        ...sectionField,
        props: {
          ...(sectionField.props as Record<string, unknown>),
          options,
          placeholderOption: "— Select section —",
        },
      },
    },
  };
}

function entrySeed(row: CommerceLookupValueDto | null): Record<string, unknown> {
  if (!row) {
    return {
      entry: { code: "", label: "", sortOrder: 4, parentId: "" },
    };
  }
  return {
    entry: {
      code: row.code,
      label: row.label,
      sortOrder: row.sortOrder,
      parentId: row.parentValueId ?? "",
    },
  };
}

function readEntryFromValues(values: Record<string, unknown>, requireParent: boolean) {
  const code = String(getAtPath(values, "entry.code") ?? "")
    .trim()
    .toLowerCase();
  const label = String(getAtPath(values, "entry.label") ?? "").trim();
  const sortOrder = Math.trunc(Number(getAtPath(values, "entry.sortOrder") ?? 0));
  const parentId = String(getAtPath(values, "entry.parentId") ?? "").trim();
  if (!code || !label) throw new Error("Code and name are required.");
  if (!Number.isFinite(sortOrder) || sortOrder < 0) throw new Error("Invalid sort order.");
  if (requireParent && !parentId) throw new Error("Choose a section.");
  return {
    code,
    label,
    sortOrder,
    parentValueId: requireParent ? parentId : null,
    imageStorageKey: null as string | null,
  };
}

export function TableManagementPage() {
  const workspace = getTableManagementWorkspace();
  const copy = getScreenConfig(workspace.screenId);
  const { auth, getAccessToken } = useAuth();
  const token = getAccessToken();

  const [sections, setSections] = useState<CommerceLookupValueDto[]>([]);
  const [tables, setTables] = useState<CommerceLookupValueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSections, setSearchSections] = useState("");
  const [searchTables, setSearchTables] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const sectionFormBase = getForm(workspace.sections.formId);
  const tableFormBase = getForm(workspace.tables.formId);
  const tableForm = useMemo(
    () => mergeSectionSelectOptions(tableFormBase, sections),
    [tableFormBase, sections]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [sec, tbl] = await Promise.all([
        listCommerceLookupValues(workspace.sections.lookupTypeId),
        listCommerceLookupValues(workspace.tables.lookupTypeId),
      ]);
      setSections(
        [...sec].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      );
      setTables(
        [...tbl].sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.code.localeCompare(b.code) ||
            a.label.localeCompare(b.label)
        )
      );
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [token, workspace.sections.lookupTypeId, workspace.tables.lookupTypeId]);

  useEffect(() => {
    if (auth.status === "signedIn" && (auth.role === "vendor" || auth.role === "admin")) {
      void load();
    }
  }, [auth.status, auth.role, load]);

  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  if (auth.status !== "signedIn" || (auth.role !== "vendor" && auth.role !== "admin")) {
    return <Navigate to="/login" replace />;
  }

  const filteredSections = sections.filter((s) => {
    const q = searchSections.trim().toLowerCase();
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  const filteredTables = tables.filter((t) => {
    const q = searchTables.trim().toLowerCase();
    if (!q) return true;
    const parent = t.parentValueId ? sectionById.get(t.parentValueId) : undefined;
    const parentText = parent ? `${parent.label} ${parent.code}` : "";
    return (
      t.code.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      parentText.toLowerCase().includes(q)
    );
  });

  const onSaveSection = async (values: Record<string, unknown>, id?: string) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const body = readEntryFromValues(values, false);
      if (id) await updateCommerceLookupValue(token, id, body);
      else await createCommerceLookupValue(token, workspace.sections.lookupTypeId, body);
      setShowAddSection(false);
      setEditingSectionId(null);
      setFormResetKey((k) => k + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onSaveTable = async (values: Record<string, unknown>, id?: string) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const body = readEntryFromValues(values, true);
      if (id) await updateCommerceLookupValue(token, id, body);
      else await createCommerceLookupValue(token, workspace.tables.lookupTypeId, body);
      setShowAddTable(false);
      setEditingTableId(null);
      setFormResetKey((k) => k + 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : formatCommerceApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: CommerceLookupValueDto, kind: "section" | "table") => {
    if (!token) return;
    if (!window.confirm(`Delete “${row.label}”?`)) return;
    setError(null);
    try {
      await deleteCommerceLookupValue(token, row.id);
      if (kind === "section") setEditingSectionId(null);
      else setEditingTableId(null);
      await load();
    } catch (e) {
      setError(formatCommerceApiError(e));
    }
  };

  return (
    <div className="lookup-admin-page table-management-page">
      <header className="lookup-admin-page__header">
        <h1 className="lookup-admin-page__title">{String(copy.title ?? "Table management")}</h1>
        <p className="lookup-admin-page__lede">{String(copy.lede ?? "")}</p>
        <p className="lookup-admin-page__registry-note">
          Driven by{" "}
          <code>config/workspaces/table-management.json</code> and JsonForm definitions in{" "}
          <code>config/forms/</code>.{" "}
          <Link to="/admin/lookups">Full lookup admin</Link>
        </p>
      </header>

      {error ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="lookup-admin-page__empty">Loading tables…</p>
      ) : (
        <div className="table-management-page__grid">
          <section className="lookup-admin-page__panel" aria-labelledby="table-sections-heading">
            <div className="lookup-admin-page__values-toolbar">
              <h2 id="table-sections-heading" className="lookup-admin-page__panel-title">
                {String(copy.sectionsPanelTitle ?? "Sections")}
              </h2>
              <button
                type="button"
                className="shell-btn shell-btn--outline lookup-admin-page__add-lookup-btn"
                disabled={!token}
                onClick={() => {
                  setShowAddSection((v) => !v);
                  setEditingSectionId(null);
                }}
              >
                {showAddSection ? "Close" : String(copy.addSectionLabel ?? "Add section")}
              </button>
            </div>
            <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
              {String(copy.sectionsPanelHint ?? "")}
            </p>
            {showAddSection ? (
              <div className="lookup-admin-page__add-panel" id="table-section-add-panel">
                <JsonForm
                  id={SECTION_FORM_ID}
                  form={sectionFormBase}
                  resetKey={`add-sec-${formResetKey}`}
                  seedValues={entrySeed(null)}
                  onSubmit={(values) => void onSaveSection(values)}
                >
                  <LookupEntryFormActions
                    formId={SECTION_FORM_ID}
                    canSave={!!token}
                    saving={saving}
                    showSaveAndAddAnother={false}
                    onCancel={() => setShowAddSection(false)}
                  />
                </JsonForm>
              </div>
            ) : null}
            <div className="lookup-admin-page__search-field">
              <input
                type="search"
                className="lookup-admin-page__select lookup-admin-page__search-input"
                value={searchSections}
                onChange={(e) => setSearchSections(e.target.value)}
                placeholder="Search sections…"
                autoComplete="off"
              />
            </div>
            {filteredSections.length === 0 ? (
              <p className="lookup-admin-page__empty">
                {String(copy.emptySections ?? "No sections yet.")}
              </p>
            ) : (
              <ul className="lookup-admin-page__list lookup-admin-page__list--scroll">
                {filteredSections.map((row) =>
                  editingSectionId === row.id ? (
                    <li key={row.id} className="lookup-admin-page__list-row">
                      <JsonForm
                        id={`edit-sec-${row.id}`}
                        form={sectionFormBase}
                        resetKey={`edit-sec-${row.id}-${formResetKey}`}
                        seedValues={entrySeed(row)}
                        onSubmit={(values) => void onSaveSection(values, row.id)}
                      >
                        <LookupEntryFormActions
                          formId={`edit-sec-${row.id}`}
                          canSave={!!token}
                          saving={saving}
                          showSaveAndAddAnother={false}
                          onCancel={() => setEditingSectionId(null)}
                        />
                      </JsonForm>
                    </li>
                  ) : (
                    <li key={row.id} className="lookup-admin-page__list-row">
                      <div className="lookup-admin-page__list-main">
                        <span className="lookup-admin-page__code">{row.code}</span>
                        <span className="lookup-admin-page__label-text">{row.label}</span>
                        <span className="lookup-admin-page__sort">Order {row.sortOrder}</span>
                      </div>
                      <div className="lookup-admin-page__list-actions">
                        <button
                          type="button"
                          className="shell-btn shell-btn--ghost"
                          onClick={() => {
                            setEditingSectionId(row.id);
                            setShowAddSection(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="shell-btn shell-btn--ghost lookup-admin-page__delete"
                          onClick={() => void onDelete(row, "section")}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>

          <section className="lookup-admin-page__panel" aria-labelledby="table-tables-heading">
            <div className="lookup-admin-page__values-toolbar">
              <h2 id="table-tables-heading" className="lookup-admin-page__panel-title">
                {String(copy.tablesPanelTitle ?? "Tables")}
              </h2>
              <button
                type="button"
                className="shell-btn shell-btn--outline lookup-admin-page__add-lookup-btn"
                disabled={!token || sections.length === 0}
                title={sections.length === 0 ? "Add a section first" : undefined}
                onClick={() => {
                  setShowAddTable((v) => !v);
                  setEditingTableId(null);
                }}
              >
                {showAddTable ? "Close" : String(copy.addTableLabel ?? "Add table")}
              </button>
            </div>
            <p className="lookup-admin-page__hint lookup-admin-page__hint--block">
              {String(copy.tablesPanelHint ?? "")}
            </p>
            {showAddTable ? (
              <div className="lookup-admin-page__add-panel">
                <JsonForm
                  id={TABLE_FORM_ID}
                  form={tableForm}
                  resetKey={`add-tbl-${formResetKey}`}
                  seedValues={entrySeed(null)}
                  onSubmit={(values) => void onSaveTable(values)}
                >
                  <LookupEntryFormActions
                    formId={TABLE_FORM_ID}
                    canSave={!!token && sections.length > 0}
                    saving={saving}
                    showSaveAndAddAnother={false}
                    onCancel={() => setShowAddTable(false)}
                  />
                </JsonForm>
              </div>
            ) : null}
            <div className="lookup-admin-page__search-field">
              <input
                type="search"
                className="lookup-admin-page__select lookup-admin-page__search-input"
                value={searchTables}
                onChange={(e) => setSearchTables(e.target.value)}
                placeholder="Search tables…"
                autoComplete="off"
              />
            </div>
            {filteredTables.length === 0 ? (
              <p className="lookup-admin-page__empty">{String(copy.emptyTables ?? "No tables yet.")}</p>
            ) : (
              <div className="lookup-admin-page__types-table-wrap lookup-admin-page__types-table-wrap--scroll">
                <table className="lookup-admin-page__types-table vendor-table">
                  <thead>
                    <tr>
                      <th scope="col">Table #</th>
                      <th scope="col">Name</th>
                      <th scope="col">Seats</th>
                      <th scope="col">Section</th>
                      <th scope="col">
                        <span className="lookup-admin-page__sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTables.map((row) => {
                      const parent = row.parentValueId
                        ? sectionById.get(row.parentValueId)
                        : undefined;
                      if (editingTableId === row.id) {
                        return (
                          <tr key={row.id}>
                            <td colSpan={5}>
                              <JsonForm
                                id={`edit-tbl-${row.id}`}
                                form={tableForm}
                                resetKey={`edit-tbl-${row.id}-${formResetKey}`}
                                seedValues={entrySeed(row)}
                                onSubmit={(values) => void onSaveTable(values, row.id)}
                              >
                                <LookupEntryFormActions
                                  formId={`edit-tbl-${row.id}`}
                                  canSave={!!token}
                                  saving={saving}
                                  showSaveAndAddAnother={false}
                                  onCancel={() => setEditingTableId(null)}
                                />
                              </JsonForm>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={row.id}>
                          <td>
                            <code>{row.code}</code>
                          </td>
                          <td>{row.label}</td>
                          <td>{row.sortOrder}</td>
                          <td>{parent?.label ?? "—"}</td>
                          <td className="lookup-admin-page__types-table-actions">
                            <div className="lookup-admin-page__types-table-actions-inner">
                              <button
                                type="button"
                                className="shell-btn shell-btn--ghost"
                                onClick={() => {
                                  setEditingTableId(row.id);
                                  setShowAddTable(false);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="shell-btn shell-btn--ghost lookup-admin-page__delete"
                                onClick={() => void onDelete(row, "table")}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <footer className="lookup-admin-page__footer lookup-admin-page__footer--compact">
        <Link to="/">← Home</Link>
      </footer>
    </div>
  );
}
