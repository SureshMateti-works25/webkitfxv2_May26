import workspace from "./workspaces/user-role-assignments.json";

export type UserRoleAssignmentsListColumn = {
  id: string;
  label: string;
  binding?: string;
  source?: "isPrimary";
};

export type PortalBaseRoleOption = {
  value: string;
  label: string;
};

export type UserRoleAssignmentsWorkspace = {
  version: string;
  screenId: string;
  allowedRoles: string[];
  formId: string;
  portalBaseRoleOptions: PortalBaseRoleOption[];
  defaultPortalBaseRole: string;
  listColumns: UserRoleAssignmentsListColumn[];
};

const typed = workspace as UserRoleAssignmentsWorkspace;

export function getUserRoleAssignmentsWorkspace(): UserRoleAssignmentsWorkspace {
  return typed;
}
