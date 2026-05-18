import { getAtPath } from "@webkitfxv2/core-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { AuthState } from "../auth/AuthContext.js";
import { useCart } from "../cart/CartContext.js";
import type { ShellConfig, ShellNavItem } from "../config/shell.types.js";

type JsonHeaderProps = {
  shell: ShellConfig;
  auth: AuthState;
  applicationTypeLabel: string;
  onSignOut: () => void;
  onContinueGuest: () => void;
};

function IconGlyph({ name, className }: { name: string; className?: string }) {
  if (name === "home") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
  if (name === "search") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
  if (name === "cart") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M3 4h2l2.3 11.2a1 1 0 0 0 1 .8H19a1 1 0 0 0 1-.8L22 7H7" /></svg>;
  if (name === "login") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></svg>;
  if (name === "logout") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
  if (name === "profile") return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>;
}

function roleKey(auth: AuthState): "guest" | "shopper" | "vendor" | "admin" {
  if (auth.status !== "signedIn") return "guest";
  return auth.role;
}

function navForAuth(shell: ShellConfig, auth: AuthState): ShellNavItem[] {
  return shell.header.navByAuth[roleKey(auth)] ?? [];
}

export function JsonHeader({
  shell,
  auth,
  applicationTypeLabel,
  onSignOut,
  onContinueGuest,
}: JsonHeaderProps) {
  const navigate = useNavigate();
  const { totalQuantity: cartQty } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement>(null);
  const labels = shell.header.sessionLabels;
  const centerNav = useMemo(() => navForAuth(shell, auth), [shell, auth]);
  const cartItem = useMemo(() => centerNav.find((item) => item.path === "/cart"), [centerNav]);
  const centerNavWithoutCart = useMemo(
    () => centerNav.filter((item) => item.path !== "/cart"),
    [centerNav]
  );

  const profileItems = auth.status === "signedIn" ? shell.header.profileMenu[auth.role] : [];
  const signedInLabel = useMemo(() => {
    if (auth.status !== "signedIn") return "";
    const email = String(getAtPath(auth.payload, "session.email") ?? "").trim();
    const login = String(getAtPath(auth.payload, "credentials.loginName") ?? "").trim();
    return email || login;
  }, [auth]);

  const profileMenuAria =
    signedInLabel.length > 0
      ? `${shell.header.profileMenuAria}: ${signedInLabel}`
      : shell.header.profileMenuAria;

  const isGuestLike = auth.status === "anonymous" || auth.status === "guest";

  const resolveNavPath = (path: string) => {
    if (path === "/" && auth.status === "signedIn" && auth.role === "vendor") return "/vendor/products";
    return path;
  };

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = profileWrapRef.current;
      if (el && !el.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  return (
    <header className="shell-header shell-header--enterprise">
      <div className="shell-header-inner">
        <div className="shell-header-start">
          <button
            type="button"
            className="shell-menu-toggle"
            aria-expanded={mobileOpen}
            aria-label="Menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link
            to="/"
            className="shell-brand"
            onClick={() => setMobileOpen(false)}
            aria-label={`${shell.app.name}, ${applicationTypeLabel}`}
          >
            <img className="shell-brand-img" src={shell.brand.logoSrc} alt="" width={216} height={45} decoding="async" />
            <span className="shell-brand-text">
              <span className="shell-brand-name">{shell.app.name}</span>
              <span className="shell-brand-app-type">{applicationTypeLabel}</span>
            </span>
          </Link>
        </div>

        <nav className="shell-nav shell-nav--icons" aria-label="Primary">
          {centerNavWithoutCart.map((item) => {
            const to = resolveNavPath(item.path);
            const navEnd = to === "/vendor/products" ? false : to === "/";
            return (
              <NavLink
                key={`${item.path}-${item.label}`}
                to={to}
                end={navEnd}
                title={item.label}
                aria-label={
                  item.path === "/cart" && cartQty > 0 ? `${item.label}, ${cartQty} items` : item.label
                }
                className={({ isActive }) =>
                  ["shell-nav-icon-btn", isActive ? "shell-nav-active" : ""].filter(Boolean).join(" ")
                }
              >
                {item.path === "/cart" && cartQty > 0 ? (
                  <span className="shell-nav-icon-stack" aria-hidden>
                    <IconGlyph name={item.icon ?? "dot"} />
                    <span className="shell-cart-badge">{cartQty > 99 ? "99+" : cartQty}</span>
                  </span>
                ) : (
                  <IconGlyph name={item.icon ?? "dot"} />
                )}
                <span className="shell-brand-sr">
                  {item.path === "/cart" && cartQty > 0 ? `${item.label}, ${cartQty} items` : item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="shell-header-end">
          {cartItem ? (
            <NavLink
              to={resolveNavPath("/cart")}
              title={cartItem.label}
              aria-label={cartQty > 0 ? `${cartItem.label}, ${cartQty} items` : cartItem.label}
              className={({ isActive }) =>
                ["shell-header-cart", isActive ? "shell-header-cart--active" : ""].filter(Boolean).join(" ")
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="shell-nav-icon-stack" aria-hidden>
                <IconGlyph name="cart" className="shell-header-cart__icon" />
                {cartQty > 0 ? (
                  <span className="shell-cart-badge">{cartQty > 99 ? "99+" : cartQty}</span>
                ) : null}
              </span>
              <span className="shell-header-cart__label">{cartItem.label}</span>
            </NavLink>
          ) : null}
          <div className="shell-header-actions">
          {auth.status === "signedIn" ? (
            <>
              <div className="shell-profile-cluster" ref={profileWrapRef}>
                {signedInLabel ? (
                  <span className="shell-user-identity" title={signedInLabel}>
                    {signedInLabel}
                  </span>
                ) : null}
                <div className="shell-settings-wrap">
                  <button
                    type="button"
                    className="shell-icon-btn"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                    aria-label={profileMenuAria}
                    onClick={() => setProfileOpen((o) => !o)}
                  >
                    <IconGlyph name="profile" />
                  </button>
                  {profileOpen ? (
                    <div className="shell-settings-panel" role="menu">
                      {profileItems.map((item) => (
                        <Link key={item.path} to={item.path} role="menuitem" onClick={() => setProfileOpen(false)}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="shell-icon-btn"
                aria-label={labels.logout}
                title={labels.logout}
                onClick={() => {
                  onSignOut();
                  navigate("/");
                }}
              >
                <IconGlyph name="logout" />
              </button>
            </>
          ) : null}
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="shell-mobile-nav" aria-label="Mobile primary">
          {centerNavWithoutCart.map((item) => {
            const to = resolveNavPath(item.path);
            const navEnd = to === "/vendor/products" ? false : to === "/";
            return (
              <NavLink
                key={`${item.path}-${item.label}`}
                to={to}
                end={navEnd}
                className={({ isActive }) => (isActive ? "shell-nav-active" : undefined)}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            );
          })}
          {auth.status === "signedIn" ? (
            <div className="shell-mobile-nav__profile" role="group" aria-label={profileMenuAria}>
              {signedInLabel ? <p className="shell-mobile-nav__identity">{signedInLabel}</p> : null}
              {profileItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => (isActive ? "shell-nav-active" : undefined)}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ) : null}
          {isGuestLike && centerNav.every((x) => x.path !== "/login") ? (
            <Link to="/login" className="shell-mobile-nav__cta" onClick={() => setMobileOpen(false)}>
              {labels.login}
            </Link>
          ) : null}
          {auth.status === "signedIn" ? (
            <button
              type="button"
              className="shell-mobile-nav__danger"
              onClick={() => {
                onSignOut();
                setMobileOpen(false);
                navigate("/");
              }}
            >
              {labels.logout}
            </button>
          ) : null}
          {auth.status === "anonymous" ? (
            <button
              type="button"
              className="shell-mobile-nav__guest"
              onClick={() => {
                onContinueGuest();
                setMobileOpen(false);
                navigate("/");
              }}
            >
              {shell.screens.login.guestCta}
            </button>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
