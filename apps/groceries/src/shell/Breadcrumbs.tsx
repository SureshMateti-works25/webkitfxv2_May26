import { Link, useLocation } from "react-router-dom";
import { getShell } from "../config/getShell.js";

function displayTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function resolveTrail(pathname: string, shell: ReturnType<typeof getShell>) {
  const direct = shell.breadcrumbs[pathname];
  if (direct) return direct;
  if (pathname.startsWith("/browse/")) {
    const seg = pathname.slice("/browse/".length).split("/")[0] ?? "";
    const slug = decodeURIComponent(seg).trim();
    if (slug)
      return [
        { label: "Home", path: "/" },
        { label: "Browse", path: "/search" },
        { label: displayTitleFromSlug(slug), path: null },
      ];
  }
  if (pathname.startsWith("/p/")) {
    return [
      { label: "Home", path: "/" },
      { label: "Product", path: null },
    ];
  }
  if (pathname.includes("/vendor/products/") && pathname.endsWith("/storefront")) {
    return [
      { label: "Home", path: "/" },
      { label: "My products", path: "/vendor/products" },
      { label: "Storefront preview", path: null },
    ];
  }
  if (pathname.startsWith("/vendor/products/") && pathname !== "/vendor/products/new") {
    return [
      { label: "Home", path: "/" },
      { label: "My products", path: "/vendor/products" },
      { label: "Product", path: null },
    ];
  }
  return [];
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const shell = getShell();
  const trail = resolveTrail(pathname, shell);

  if (trail.length === 0) return null;

  return (
    <nav className="shell-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`}>
            {crumb.path ? <Link to={crumb.path}>{crumb.label}</Link> : <span>{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
