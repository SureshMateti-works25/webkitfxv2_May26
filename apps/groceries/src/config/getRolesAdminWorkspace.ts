import workspace from "./workspaces/roles-admin.json";

export type RolesAdminListColumn = {
  id: string;
  label: string;
  binding?: string;
  source?: "permissionCount";
};

export type RolesAdminDefaultRole = {
  roleKey: string;
  displayName: string;
  description?: string;
  permissions: string[];
};

export type RolesAdminWorkspace = {
  version: string;
  screenId: string;
  allowedRoles: string[];
  formId: string;
  permissionGroupOrder: string[];
  listColumns: RolesAdminListColumn[];
  defaultRoles: RolesAdminDefaultRole[];
};

const typed = workspace as RolesAdminWorkspace;

export function getRolesAdminWorkspace(): RolesAdminWorkspace {
  return typed;
}
