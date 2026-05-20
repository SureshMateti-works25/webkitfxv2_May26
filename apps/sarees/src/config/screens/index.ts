import rolesAdminScreen from "./roles-admin.json";
import userRoleAssignmentsScreen from "./user-role-assignments.json";

export type AppScreenDefinition = { copy: Record<string, string> };

export const screenDefinitions: Record<string, AppScreenDefinition> = {
  rolesAdmin: rolesAdminScreen as AppScreenDefinition,
  userRoleAssignments: userRoleAssignmentsScreen as AppScreenDefinition,
};
