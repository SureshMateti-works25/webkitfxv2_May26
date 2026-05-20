import portalUsersAdmin from "./screens/portal-users-admin.json";
import type { AppScreenDefinition } from "./screens/index.js";

export function getPortalUsersAdminScreen(): AppScreenDefinition {
  return portalUsersAdmin as AppScreenDefinition;
}
