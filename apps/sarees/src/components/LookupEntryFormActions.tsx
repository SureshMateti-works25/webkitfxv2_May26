type LookupEntryFormActionsProps = {
  formId?: string;
  canSave: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSave?: () => void;
  onSaveAndAddAnother?: () => void;
  showSaveAndAddAnother?: boolean;
};

/** Save / Cancel bar for lookup add & edit panels (use at top and bottom). */
export function LookupEntryFormActions({
  formId,
  canSave,
  saving = false,
  onCancel,
  onSave,
  onSaveAndAddAnother,
  showSaveAndAddAnother = true,
}: LookupEntryFormActionsProps) {
  const saveLabel = saving ? "Saving…" : "Save";
  const disabled = !canSave || saving;

  return (
    <div
      className="lookup-admin-page__form-actions lookup-admin-page__form-actions--bar"
      role="group"
      aria-label="Entry actions"
    >
      {formId ? (
        <button type="submit" form={formId} className="shell-btn shell-btn--primary" disabled={disabled}>
          {saveLabel}
        </button>
      ) : (
        <button type="button" className="shell-btn shell-btn--primary" disabled={disabled} onClick={onSave}>
          {saveLabel}
        </button>
      )}
      {showSaveAndAddAnother && onSaveAndAddAnother ? (
        <button
          type="button"
          className="shell-btn shell-btn--outline"
          disabled={disabled}
          onClick={onSaveAndAddAnother}
        >
          Save &amp; add another
        </button>
      ) : null}
      <button type="button" className="shell-btn shell-btn--outline" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
