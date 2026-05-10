import { Link, useLocation } from "react-router-dom";
import { getShell } from "../config/getShell.js";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const shell = getShell();
  const trail = shell.breadcrumbs[pathname] ?? [];

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
