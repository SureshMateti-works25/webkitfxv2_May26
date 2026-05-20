import brandingCatalog from "../config/tenantBranding.json";
import type { ShellConfig } from "../config/shell.types.js";
import { getShell } from "../config/getShell.js";
import { commerceTenantHeaders } from "./commerceApi.js";
import { getCommerceTenantId } from "../dev/devTenantStore.js";

export type LoginWelcomeHighlight = { title: string; body: string };

export type TenantBrandingEntry = {
  appName?: string;
  tagline?: string;
  logoSrc?: string;
  logoAlt?: string;
  applicationTypeLabel?: string;
  modeBadge?: string;
  loginHeadline?: string;
  loginIntro?: string;
  welcomeHighlights?: LoginWelcomeHighlight[];
  /** Scrolling header notice (marquee). */
  marqueeMessage?: string;
};

type BrandingCatalog = Record<string, TenantBrandingEntry>;

const catalog = brandingCatalog as BrandingCatalog;

function mergeLoginWelcome(
  base: ShellConfig["screens"]["login"]["welcome"],
  input: {
    applicationTypeLabel: string;
    loginHeadline: string;
    loginIntro: string;
    entry?: TenantBrandingEntry;
  }
): ShellConfig["screens"]["login"]["welcome"] {
  const highlights =
    input.entry?.welcomeHighlights?.filter((h) => h.title?.trim() && h.body?.trim()) ??
    base.highlights;

  return {
    eyebrow: input.applicationTypeLabel.trim() || base.eyebrow,
    headline: input.loginHeadline.trim() || base.headline,
    intro:
      input.entry?.tagline?.trim() ||
      input.loginIntro.trim() ||
      base.intro,
    highlightsTitle: base.highlightsTitle,
    highlights: highlights.length > 0 ? highlights : base.highlights,
  };
}

export function getTenantBrandingEntry(tenantId: string): TenantBrandingEntry | undefined {
  return catalog[tenantId.trim()];
}

export type TenantBootstrapLite = {
  tenantId: string;
  name: string;
  slug: string;
  storefrontMode: string;
  vertical?: string | null;
};

export async function fetchTenantBootstrapLite(tenantId: string): Promise<TenantBootstrapLite | null> {
  try {
    const res = await fetch(`/api/v1/tenants/${encodeURIComponent(tenantId)}/bootstrap`, {
      headers: commerceTenantHeaders(),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return null;
    return {
      tenantId: String(data.tenantId ?? tenantId),
      name: String(data.name ?? ""),
      slug: String(data.slug ?? ""),
      storefrontMode: String(data.storefrontMode ?? "isolated_shop"),
      vertical: data.vertical == null ? null : String(data.vertical),
    };
  } catch {
    return null;
  }
}

export type ResolvedTenantChrome = {
  tenantId: string;
  displayName: string;
  applicationTypeLabel: string;
  modeBadge?: string;
  shell: ShellConfig;
};

export async function resolveTenantChrome(
  tenantId: string = getCommerceTenantId()
): Promise<ResolvedTenantChrome> {
  const base = getShell();
  const entry = getTenantBrandingEntry(tenantId);
  const bootstrap = await fetchTenantBootstrapLite(tenantId);

  const apiName = bootstrap?.name?.trim() || "";
  const displayName = entry?.appName?.trim() || apiName || base.app.name;

  const baseTypeLabel =
    entry?.applicationTypeLabel?.trim() ||
    base.app.applicationTypeLabel?.trim() ||
    "Storefront";

  const mode =
    bootstrap?.storefrontMode === "marketplace" || entry?.modeBadge
      ? entry?.modeBadge ?? "Marketplace"
      : undefined;

  const applicationTypeLabel = mode ? `${baseTypeLabel} · ${mode}` : baseTypeLabel;

  const loginHeadline =
    entry?.loginHeadline?.trim() ||
    (apiName ? `Welcome to ${displayName}` : base.screens.login.welcome.headline);
  const loginIntro = entry?.loginIntro?.trim() || base.screens.login.lede;
  const welcome = mergeLoginWelcome(base.screens.login.welcome, {
    applicationTypeLabel: baseTypeLabel,
    loginHeadline,
    loginIntro,
    entry,
  });

  const noticeMessage =
    entry?.marqueeMessage?.trim() ||
    base.header.notificationBar?.message?.trim() ||
    "";
  const noticeAria =
    base.header.notificationBar?.ariaLabel?.trim() || "Café announcements";

  const shell: ShellConfig = {
    ...base,
    app: {
      ...base.app,
      name: displayName,
      tagline: entry?.tagline?.trim() || base.app.tagline,
      applicationTypeLabel: baseTypeLabel,
    },
    header: {
      ...base.header,
      notificationBar: noticeMessage
        ? { message: noticeMessage, ariaLabel: noticeAria }
        : base.header.notificationBar,
    },
    brand: {
      logoAlt: entry?.logoAlt?.trim() || displayName || base.brand.logoAlt,
      logoSrc: entry?.logoSrc?.trim() || base.brand.logoSrc,
    },
    screens: {
      ...base.screens,
      login: {
        ...base.screens.login,
        lede: loginIntro,
        welcome,
      },
      shopperSignup: {
        ...base.screens.shopperSignup,
        title: `${displayName} — shopper profile`,
      },
      vendorSignup: {
        ...base.screens.vendorSignup,
        title: `${displayName} — vendor registration`,
      },
    },
  };

  return {
    tenantId,
    displayName,
    applicationTypeLabel,
    modeBadge: mode,
    shell,
  };
}
