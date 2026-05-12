import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import type { ShellEdgeChromeConfig, ShellEdgeCtaItem } from "../config/shell.types.js";
import { getShell } from "../config/getShell.js";
import {
  isEdgeChromeItemVisible,
  resolveEdgeChromeAudience,
} from "../lib/edgeChromeVisibility.js";
import { buildWhatsAppChatUrl, formatWhatsAppMessage } from "../lib/whatsappDeepLink.js";

function IconWhatsapp({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 32 32" aria-hidden fill="currentColor">
      <path d="M16.003 3C9.385 3 4 8.042 4 14.223c0 2.216.652 4.28 1.781 6.015L4 29l9.02-1.748A11.02 11.02 0 0016.003 25.44 11.56 11.56 0 0028 14.223C28 8.042 22.615 3 16.003 3zm0 20.44c-1.9 0-3.68-.5-5.22-1.37l-.37-.22-5.05.98 1.01-4.92-.24-.39a8.56 8.56 0 01-1.35-4.6c0-5.08 4.58-9.21 10.23-9.21 5.65 0 10.23 4.13 10.23 9.21S21.65 23.44 16.003 23.44z" />
    </svg>
  );
}

function IconDemo({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconSupport({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 1.5-2.5 3.5" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function CtaIcon({ id }: { id: ShellEdgeCtaItem["icon"] }) {
  if (id === "demo") return <IconDemo className="floating-cta-stack__glyph" />;
  if (id === "support") return <IconSupport className="floating-cta-stack__glyph" />;
  return <IconWhatsapp className="floating-cta-stack__glyph" />;
}

function resolveHref(item: ShellEdgeCtaItem, pageUrl: string, fallbackWaDigits?: string): string | null {
  if (item.kind === "whatsapp") {
    const digits = ((item.phoneDigits ?? "").trim() || (fallbackWaDigits ?? "").trim()).replace(/\D/g, "");
    if (!digits) return null;
    const tpl = item.messageTemplate ?? "Hi — I'm on {{url}}";
    const text = formatWhatsAppMessage(tpl, { url: pageUrl });
    return buildWhatsAppChatUrl(digits, text);
  }
  if (item.kind === "tel") {
    const h = (item.href ?? "").trim();
    if (!h) return null;
    return h.startsWith("tel:") ? h : `tel:${h.replace(/^tel:/i, "")}`;
  }
  const h = (item.href ?? "").trim();
  return h.length > 0 ? h : null;
}

type Props = { edge: ShellEdgeChromeConfig };

export function FloatingCtaStack({ edge }: Props) {
  const shell = getShell();
  const { auth } = useAuth();
  const { pathname } = useLocation();
  const audience = useMemo(() => resolveEdgeChromeAudience(auth), [auth]);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${pathname}`;
  }, [pathname]);

  const stack = edge.floatingStack;
  if (!stack?.enabled || !stack.items?.length) return null;

  const fallbackWa = shell.storefront?.whatsapp?.phoneDigits;

  const items = stack.items.filter((it) =>
    isEdgeChromeItemVisible({
      audiences: it.audiences,
      pathPrefixes: it.pathPrefixes,
      pathPrefixesExclude: it.pathPrefixesExclude,
      pathname,
      currentAudience: audience,
    })
  );

  if (items.length === 0) return null;

  const ariaToolbar = stack.ariaLabel ?? "Quick actions";

  return (
    <nav className="floating-cta-stack" aria-label={ariaToolbar}>
      <ul className="floating-cta-stack__list">
        {items.map((item) => {
          const href = resolveHref(
            item,
            pageUrl || `${typeof window !== "undefined" ? window.location.origin : ""}${pathname}`,
            fallbackWa
          );
          if (!href || href === "#") return null;
          const ext = item.kind === "link" && /^https?:\/\//i.test(href);
          const label = item.label.trim();
          const shortL = (item.shortLabel ?? item.label).trim();
          return (
            <li key={item.id} className="floating-cta-stack__item">
              <a
                className={`floating-cta-stack__btn floating-cta-stack__btn--${item.icon}`}
                href={href}
                {...(ext || item.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={label}
                title={label}
              >
                <span className="floating-cta-stack__icon" aria-hidden>
                  <CtaIcon id={item.icon} />
                </span>
                <span className="floating-cta-stack__label">{label}</span>
                <span className="floating-cta-stack__label floating-cta-stack__label--short">{shortL}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
