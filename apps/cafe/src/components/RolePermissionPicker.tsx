import type { CommercePermissionCatalogEntry } from "../lib/commerceApi.js";

type Props = {
  catalog: CommercePermissionCatalogEntry[];
  groupOrder: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

function groupCatalog(
  catalog: CommercePermissionCatalogEntry[],
  groupOrder: string[]
): { group: string; items: CommercePermissionCatalogEntry[] }[] {
  const byGroup = new Map<string, CommercePermissionCatalogEntry[]>();
  for (const item of catalog) {
    const g = item.group?.trim() || "General";
    const list = byGroup.get(g) ?? [];
    list.push(item);
    byGroup.set(g, list);
  }
  const ordered: { group: string; items: CommercePermissionCatalogEntry[] }[] = [];
  for (const g of groupOrder) {
    const items = byGroup.get(g);
    if (items?.length) {
      ordered.push({ group: g, items: [...items].sort((a, b) => a.label.localeCompare(b.label)) });
      byGroup.delete(g);
    }
  }
  for (const [group, items] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    ordered.push({ group, items: [...items].sort((a, b) => a.label.localeCompare(b.label)) });
  }
  return ordered;
}

export function RolePermissionPicker({ catalog, groupOrder, selected, onChange, disabled }: Props) {
  const groups = groupCatalog(catalog, groupOrder);
  const selectedSet = new Set(selected.map((p) => p.toLowerCase()));

  const toggle = (id: string) => {
    if (disabled) return;
    const key = id.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((p) => p.toLowerCase() !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="role-permission-picker" aria-disabled={disabled}>
      {groups.map(({ group, items }) => (
        <fieldset key={group} className="role-permission-picker__group">
          <legend className="role-permission-picker__legend">{group}</legend>
          <ul className="role-permission-picker__list">
            {items.map((item) => {
              const id = item.id.toLowerCase();
              const checked = selectedSet.has(id);
              return (
                <li key={id}>
                  <label className="role-permission-picker__item">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(id)}
                    />
                    <span className="role-permission-picker__label">{item.label}</span>
                    <code className="role-permission-picker__code">{id}</code>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
