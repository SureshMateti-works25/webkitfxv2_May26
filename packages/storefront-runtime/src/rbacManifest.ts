import type { TenantRbacManifest } from "./types.js";
import manifestJson from "../../../config/commerce/tenant-rbac.json" with { type: "json" };

export const tenantRbacManifest = manifestJson as TenantRbacManifest;
