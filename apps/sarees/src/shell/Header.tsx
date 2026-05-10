import { getAtPath } from "@webkitfxv2/core-engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getShell } from "../config/getShell.js";
import type { ShellNavItem } from "../config/shell.types.js";

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const ACTION_PATHS = new Set(["/login"]);

function splitHeaderMenu(menu: ShellNavItem[]) {
  const center = menu.filter((i) => !ACTION_PATHS.has(i.path));
  return { center };
}

export function Header() {
  const shell = getShell();
  const { auth, signOut, continueGuest } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement>(null);
  const labels = shell.header.sessionLabels;

  const { center: centerNav } = useMemo(() => splitHeaderMenu(shell.header.menu), [shell.header.menu]);

  const profileItems =
    auth.status === "signedIn" ? shell.header.profileMenu[auth.role] : [];

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
            <IconMenu />
          </button>
          <Link
            to="/"
            className="shell-brand"
            onClick={() => setMobileOpen(false)}
            aria-label={`${shell.app.name} home`}
          >
            <img
              className="shell-brand-img"
              src={shell.brand.logoSrc}
              alt=""
              width={216}
              height={45}
              decoding="async"
            />
            <span className="shell-brand-sr">{shell.app.name}</span>
          </Link>
        </div>

        <nav className="shell-nav" aria-label="Primary">
          {centerNav.map((item) => {
            const to = resolveNavPath(item.path);
            const navEnd = to === "/vendor/products" ? false : to === "/";
            return (
              <NavLink
                key={item.path}
                to={to}
                end={navEnd}
                className={({ isActive }) => (isActive ? "shell-nav-active" : undefined)}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="shell-header-actions">
          <button type="button" className="shell-icon-btn" aria-label="Search">
            <IconSearch />
          </button>
          {isGuestLike ? (
            <Link to="/login" className="shell-btn shell-btn--primary">
              {labels.login}
            </Link>
          ) : null}
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
                    <IconUser />
                  </button>
                  {profileOpen ? (
                    <div className="shell-settings-panel" role="menu">
                      {profileItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          role="menuitem"
                          onClick={() => setProfileOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="shell-btn shell-btn--outline"
                onClick={() => {
                  signOut();
                  navigate("/");
                }}
              >
                {labels.logout}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {mobileOpen ? (
        <nav className="shell-mobile-nav" aria-label="Mobile primary">
          {shell.header.menu.map((item) => {
            const to = resolveNavPath(item.path);
            const navEnd = to === "/vendor/products" ? false : to === "/";
            return (
              <NavLink
                key={item.path}
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
              {signedInLabel ? (
                <p className="shell-mobile-nav__identity">{signedInLabel}</p>
              ) : null}
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
          {isGuestLike ? (
            <Link to="/login" className="shell-mobile-nav__cta" onClick={() => setMobileOpen(false)}>
              {labels.login}
            </Link>
          ) : (
            <button
              type="button"
              className="shell-mobile-nav__danger"
              onClick={() => {
                signOut();
                setMobileOpen(false);
                navigate("/");
              }}
            >
              {labels.logout}
            </button>
          )}
          {auth.status === "anonymous" ? (
            <button
              type="button"
              className="shell-mobile-nav__guest"
              onClick={() => {
                continueGuest();
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
