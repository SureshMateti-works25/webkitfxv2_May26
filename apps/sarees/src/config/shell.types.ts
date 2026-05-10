/** Shape of `src/config/shell.json` — all chrome & landing copy lives here. */

export type ShellNavItem = { label: string; path: string };

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

export type ShellConfig = {
  app: { name: string; tagline: string };
  brand: { logoAlt: string; logoSrc: string };
  header: {
    sessionLabels: { guest: string; member: string; logout: string; login: string };
    /** Account menu in the app header (signed-in shoppers vs vendors). */
    profileMenuAria: string;
    profileMenu: { shopper: ShellNavItem[]; vendor: ShellNavItem[] };
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
    cart: { title: string; body: string };
    accountProfile: { title: string; body: string };
    favourites: { title: string; body: string };
    orders: { title: string; body: string };
    communication: { title: string; body: string };
  };
};
