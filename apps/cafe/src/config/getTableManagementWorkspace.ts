import workspace from "./workspaces/table-management.json";

export type TableManagementListColumn = {
  id: string;
  label: string;
  binding?: string;
  source?: "parentLabel";
};

export type TableManagementEntityWorkspace = {
  lookupTypeId: string;
  formId: string;
  parentLookupTypeId?: string;
  parentFieldLabel?: string;
  listColumns: TableManagementListColumn[];
};

export type TableManagementWorkspace = {
  version: string;
  screenId: string;
  roles: string[];
  sections: TableManagementEntityWorkspace;
  tables: TableManagementEntityWorkspace;
};

const typed = workspace as TableManagementWorkspace;

export function getTableManagementWorkspace(): TableManagementWorkspace {
  return typed;
}
