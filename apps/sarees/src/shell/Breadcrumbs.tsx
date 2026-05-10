import { Link, useLocation } from "react-router-dom";
import { getShell } from "../config/getShell.js";

function resolveTrail(pathname: string, shell: ReturnType<typeof getShell>) {
  const direct = shell.breadcrumbs[pathname];
  if (direct) return direct;
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
