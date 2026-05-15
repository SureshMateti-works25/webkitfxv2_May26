/** Shape of `src/config/shell.json` — all chrome & landing copy lives here. */

export type ShellAuthRole = "guest" | "shopper" | "vendor" | "admin";

export type ShellNavItem = { label: string; path: string; icon?: string };

export type ShellBreadcrumbItem = { label: string; path: string | null };

export type ShellHeroAction = {
  label: string;
  path: string;
  variant?: "primary" | "secondary" | "ghost";
};

export type ShellLandingSection =
  | { type: "strap"; message: string }
  | {
      type: "hero";
      /** `cream` = light retail page (NISTTA-style); `dark` = full-bleed immersive band */
      surface?: "cream" | "dark";
      /** Thin label above kicker, e.g. sector or programme name */
      eyebrow?: string;
      /** Short brand line (reference sites often lead with a craft / quality line) */
      kicker?: string;
      title: string;
      subtitle: string;
      /** One-line trust / logistics line under subtitle */
      trustLine?: string;
      actions: ShellHeroAction[];
    }
  | {
      type: "highlights";
      title: string;
      items: { title: string; body: string }[];
    };

export type LoginEnterpriseTrend = { title: string; body: string };
export type LoginEnterpriseMetric = { label: string; value: string };

/** PDP / cart chrome: WhatsApp deep link from product imagery (config-driven). */
export type ShellStorefrontWhatsApp = {
  enabled: boolean;
  /** Digits only or E.164 — non-digits stripped for `wa.me`. */
  phoneDigits: string;
  /** Placeholders: {{title}}, {{url}}, {{vendor}}, {{sku}} */
  messageTemplate: string;
};

export type ShellStorefrontConfig = {
  whatsapp?: ShellStorefrontWhatsApp;
};

/**
 * Who sees edge chrome (floating CTAs / promotion rail).
 * Maps to `AuthState`: anonymous → `anonymous`, guest → `guest`, signed-in → portal role.
 */
export type EdgeChromeAudience = "anonymous" | "guest" | "shopper" | "vendor" | "admin";

/** Floating action: WhatsApp deep link, in-app route, tel:, or external URL. */
export type ShellEdgeCtaKind = "whatsapp" | "link" | "tel";

export type ShellEdgeCtaItem = {
  id: string;
  kind: ShellEdgeCtaKind;
  /** Primary label (desktop); keep concise. */
  label: string;
  /** Optional compact label for narrow viewports. */
  shortLabel?: string;
  /** `link` / `tel`: target URL or `tel:+...`. */
  href?: string;
  /** `whatsapp`: digits for wa.me (non-digits stripped). */
  phoneDigits?: string;
  /** `whatsapp`: message with `{{url}}` = current page URL. */
  messageTemplate?: string;
  icon: "whatsapp" | "demo" | "support";
  /** If set, item shows only for these audiences. If omitted/empty → all audiences. */
  audiences?: EdgeChromeAudience[];
  /**
   * If set, show only when `location.pathname` equals or starts with one prefix.
   * If omitted/empty → all paths (subject to `pathPrefixesExclude`).
   */
  pathPrefixes?: string[];
  /** Hide when pathname matches any prefix (longest wins after includes). */
  pathPrefixesExclude?: string[];
};

export type ShellPromotionCardVariant = "neutral" | "accent" | "highlight";

export type ShellPromotionCard = {
  id: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  variant?: ShellPromotionCardVariant;
  audiences?: EdgeChromeAudience[];
  pathPrefixes?: string[];
  pathPrefixesExclude?: string[];
};

/**
 * Right column: floating CTA stack + optional in-page offers column (`ShellBodyWithPromo`).
 * Admin tooling can overwrite this blob at deploy or runtime when wired.
 */
export type ShellEdgeChromeConfig = {
  enabled?: boolean;
  floatingStack?: {
    enabled?: boolean;
    /** Accessible name for the vertical toolbar. */
    ariaLabel?: string;
    items: ShellEdgeCtaItem[];
  };
  promotionRail?: {
    enabled?: boolean;
    /** Panel / drawer title. */
    title?: string;
    cards: ShellPromotionCard[];
    /** `<details>` summary label on small viewports (in-flow, not a fixed overlay). */
    mobileToggleLabel?: string;
  };
};

export type ShellConfig = {
  app: { name: string; tagline: string };
  brand: { logoAlt: string; logoSrc: string };
  /** Optional consumer storefront integrations (WhatsApp, etc.). */
  storefront?: ShellStorefrontConfig;
  /**
   * Floating CTAs + in-page offers column (`ShellBodyWithPromo`); role/path rules in JSON.
   * Admin tooling can overwrite this blob at deploy or runtime when wired.
   */
  edgeChrome?: ShellEdgeChromeConfig;
  header: {
    sessionLabels: { guest: string; member: string; logout: string; login: string };
    notificationBar?: { message: string; ariaLabel?: string };
    /** Primary nav buttons resolved by auth role. */
    navByAuth: Record<ShellAuthRole, ShellNavItem[]>;
    /** Account menu in the app header (signed-in shoppers, vendors, admins). */
    profileMenuAria: string;
    profileMenu: { shopper: ShellNavItem[]; vendor: ShellNavItem[]; admin: ShellNavItem[] };
    menu: ShellNavItem[];
    settingsMenu: ShellNavItem[];
  };
  breadcrumbs: Record<string, ShellBreadcrumbItem[]>;
  footer: {
    blurb: string;
    contact: { label: string; email: string; hours: string };
    support: { label: string; phone: string; linkLabel: string; linkPath: string };
    links: ShellNavItem[];
    copyright: string;
  };
  landing: { sections: ShellLandingSection[] };
  screens: {
    login: {
      title: string;
      /** Thin full-width line above split (portal / compliance messaging) */
      ribbon?: string;
      cardTitle: string;
      lede: string;
      guestCta: string;
      submitMember: string;
      signupLinks: ShellNavItem[];
      enterprise: {
        eyebrow: string;
        headline: string;
        intro: string;
        trendsTitle: string;
        trends: LoginEnterpriseTrend[];
        metrics: LoginEnterpriseMetric[];
        footerNote: string;
      };
    };
    vendorSignup: { title: string; lede: string; submitLabel: string };
    shopperSignup: { title: string; lede: string; submitLabel: string };
    settings: { title: string; body: string };
    support: { title: string; body: string };
    legalPrivacy: { title: string; body: string };
    legalTerms: { title: string; body: string };
    cart: {
      title: string;
      body: string;
      emptyHint?: string;
      lineQtyLabel?: string;
      removeLineLabel?: string;
      clearCartLabel?: string;
      continueShoppingLabel?: string;
      subtotalLabel?: string;
    };
    accountProfile: { title: string; body: string };
    favourites: { title: string; body: string };
    orders: { title: string; body: string };
    communication: { title: string; body: string };
    search: { title: string; body: string; noResults: string; noAttributesHint: string };
    adminVendors: { title: string; body: string };
    adminShoppers: { title: string; body: string };
    adminOrders: { title: string; body: string };
  };
};
