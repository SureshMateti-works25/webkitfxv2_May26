import type { AuthState } from "../auth/AuthContext.js";
import type { EdgeChromeAudience, ShellEdgeChromeConfig, ShellPromotionCard } from "../config/shell.types.js";

function normPrefix(p: string): string {
  const t = p.trim();
  if (!t) return "";
  return t.startsWith("/") ? t : `/${t}`;
}

/** True when pathname is exactly `prefix` or a nested path under `prefix`. */
export function pathMatchesEdgePrefixes(pathname: string, prefixes: string[] | undefined): boolean {
  if (!prefixes || prefixes.length === 0) return true;
  const path = pathname && pathname.length > 0 ? pathname : "/";
  return prefixes.some((raw) => {
    const p = normPrefix(raw);
    if (!p) return false;
    if (path === p) return true;
    const withSlash = p.endsWith("/") ? p : `${p}/`;
    return path.startsWith(withSlash);
  });
}

/** True when pathname matches any exclude prefix (hide item). */
export function pathMatchesEdgeExclude(pathname: string, excludes: string[] | undefined): boolean {
  if (!excludes || excludes.length === 0) return false;
  return pathMatchesEdgePrefixes(pathname, excludes);
}

export function resolveEdgeChromeAudience(auth: AuthState): EdgeChromeAudience {
  if (auth.status === "anonymous") return "anonymous";
  if (auth.status === "guest") return "guest";
  if (auth.status === "signedIn") {
    if (auth.role === "vendor") return "vendor";
    if (auth.role === "admin") return "admin";
    return "shopper";
  }
  return "guest";
}

export function audienceAllowsEdgeItem(
  audiences: EdgeChromeAudience[] | undefined,
  current: EdgeChromeAudience
): boolean {
  if (!audiences || audiences.length === 0) return true;
  return audiences.includes(current);
}

export function isEdgeChromeItemVisible(args: {
  audiences?: EdgeChromeAudience[];
  pathPrefixes?: string[];
  pathPrefixesExclude?: string[];
  pathname: string;
  currentAudience: EdgeChromeAudience;
}): boolean {
  const { audiences, pathPrefixes, pathPrefixesExclude, pathname, currentAudience } = args;
  if (!audienceAllowsEdgeItem(audiences, currentAudience)) return false;
  if (pathMatchesEdgeExclude(pathname, pathPrefixesExclude)) return false;
  return pathMatchesEdgePrefixes(pathname, pathPrefixes);
}

/** Cards visible for this path + audience (promotion rail). */
export function getVisiblePromotionCards(
  rail: ShellEdgeChromeConfig["promotionRail"] | undefined,
  pathname: string,
  audience: EdgeChromeAudience
): ShellPromotionCard[] {
  if (!rail?.enabled || !rail.cards?.length) return [];
  return rail.cards.filter((c) =>
    isEdgeChromeItemVisible({
      audiences: c.audiences,
      pathPrefixes: c.pathPrefixes,
      pathPrefixesExclude: c.pathPrefixesExclude,
      pathname,
      currentAudience: audience,
    })
  );
}
