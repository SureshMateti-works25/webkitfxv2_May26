import type { StorefrontMode, TenantRbacManifest } from "./types.js";
import { tenantRbacManifest } from "./rbacManifest.js";

export function createRbacEvaluator(manifest: TenantRbacManifest = tenantRbacManifest) {
  function isDenied(storefrontMode: string, permission: string): boolean {
    const mode = manifest.storefrontModes[storefrontMode.trim().toLowerCase()];
    if (!mode) return false;
    return mode.deniedPermissions.includes(permission);
  }

  function hasPermission(role: string, storefrontMode: StorefrontMode | string, permission: string): boolean {
    const roleDef = manifest.roles[role.trim().toLowerCase()];
    if (!roleDef) return false;
    const perm = permission.trim().toLowerCase();
    if (roleDef.permissions.includes("*")) return !isDenied(storefrontMode, perm);
    if (!roleDef.permissions.includes(perm)) return false;
    return !isDenied(storefrontMode, perm);
  }

  function permissionsFor(role: string, storefrontMode: StorefrontMode | string): string[] {
    const roleDef = manifest.roles[role.trim().toLowerCase()];
    if (!roleDef) return [];
    if (roleDef.permissions.includes("*")) {
      return roleDef.permissions.filter((p) => !isDenied(storefrontMode, p));
    }
    return roleDef.permissions.filter((p) => !isDenied(storefrontMode, p));
  }

  function featuresFor(storefrontMode: StorefrontMode | string): string[] {
    return manifest.storefrontModes[storefrontMode.trim().toLowerCase()]?.features ?? [];
  }

  function canSelfRegister(role: string): boolean {
    return manifest.registerableRoles.includes(role.trim().toLowerCase());
  }

  return { hasPermission, permissionsFor, featuresFor, canSelfRegister, manifest };
}

export const defaultRbac = createRbacEvaluator();
