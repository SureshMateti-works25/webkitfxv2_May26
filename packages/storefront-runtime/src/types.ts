export type StorefrontMode = "marketplace" | "isolated_shop";

export type StorefrontRuntimeConfig = {
  tenantId: string;
  storefrontMode: StorefrontMode;
  vertical?: string;
};

export type TenantBootstrapResponse = {
  tenantId: string;
  name: string;
  slug: string;
  storefrontMode: StorefrontMode;
  vertical?: string | null;
  isActive: boolean;
  features: string[];
  rbacVersion: number;
};

export type TenantRbacManifest = {
  version: number;
  registerableRoles: string[];
  roles: Record<string, { permissions: string[] }>;
  storefrontModes: Record<
    string,
    { features: string[]; deniedPermissions: string[] }
  >;
};
