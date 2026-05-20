import { Link } from "react-router-dom";
import { useTenantChrome } from "../lib/useTenantChrome.js";

export function Footer() {
  const { shell } = useTenantChrome();
  const { footer, app } = shell;

  return (
    <footer className="shell-footer">
      <div className="shell-footer-grid">
        <div>
          <h3 className="shell-app-name shell-footer__app-title">{app.name}</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{footer.blurb}</p>
        </div>
        <div>
          <h3>{footer.contact.label}</h3>
          <p style={{ margin: 0 }}>{footer.contact.email}</p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem" }}>{footer.contact.hours}</p>
        </div>
        <div>
          <h3>{footer.support.label}</h3>
          <p style={{ margin: 0 }}>{footer.support.phone}</p>
          <p style={{ margin: "0.35rem 0 0" }}>
            <Link to={footer.support.linkPath}>{footer.support.linkLabel}</Link>
          </p>
        </div>
      </div>
      <div className="shell-footer-meta">
        <div className="shell-footer-links" style={{ flexDirection: "row", flexWrap: "wrap", gap: "0.75rem" }}>
          {footer.links.map((l) => (
            <Link key={l.path} to={l.path}>
              {l.label}
            </Link>
          ))}
        </div>
        <p style={{ margin: "0.75rem 0 0" }}>
          {footer.copyright} · <span className="shell-app-name">{app.name}</span>
        </p>
      </div>
    </footer>
  );
}
