import { Link } from "react-router-dom";
import type { ShellPromotionCard } from "../config/shell.types.js";

function isInternal(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export type PromotionSidebarProps = {
  panelTitle: string;
  /** `<details>` summary on small screens */
  summaryLabel: string;
  cards: ShellPromotionCard[];
  /** When false, render rail markup without the outer `<aside>` (parent provides `shell-promo-aside`). */
  wrapAside?: boolean;
};

function PromotionCard({ card, variant }: { card: ShellPromotionCard; variant?: "mobile" }) {
  const v = card.variant ?? "neutral";
  const base = variant === "mobile" ? "promotion-card promotion-card--mobile" : "promotion-card";
  return (
    <li className={`${base} promotion-card--${v}`}>
      <h3 className="promotion-card__title">{card.title}</h3>
      <p className="promotion-card__body">{card.body}</p>
      {card.ctaLabel && card.ctaHref ? (
        <p className="promotion-card__cta">
          {isInternal(card.ctaHref) ? (
            <Link to={card.ctaHref} className="promotion-card__cta-link">
              {card.ctaLabel}
            </Link>
          ) : (
            <a href={card.ctaHref} className="promotion-card__cta-link" target="_blank" rel="noopener noreferrer">
              {card.ctaLabel}
            </a>
          )}
        </p>
      ) : null}
    </li>
  );
}

function CardList({ cards, listClass }: { cards: ShellPromotionCard[]; listClass: string }) {
  return (
    <ul className={listClass}>
      {cards.map((c) => (
        <PromotionCard key={c.id} card={c} />
      ))}
    </ul>
  );
}

/**
 * In-page offers column (sticky on wide viewports) + native `<details>` on small screens.
 */
export function PromotionSidebar({ panelTitle, summaryLabel, cards, wrapAside = true }: PromotionSidebarProps) {
  if (cards.length === 0) return null;

  const inner = (
    <>
      <div className="promotion-rail promotion-rail--embedded promotion-rail--lg-up">
        <h2 className="promotion-rail__title">{panelTitle}</h2>
        <CardList cards={cards} listClass="promotion-rail__cards" />
      </div>

      <details className="promotion-rail-mobile promotion-rail-mobile--embedded promotion-rail--sm-down">
        <summary className="promotion-rail-mobile__summary">{summaryLabel}</summary>
        <div className="promotion-rail-mobile__panel">
          <h2 className="promotion-rail__title promotion-rail__title--in-panel">{panelTitle}</h2>
          <CardList cards={cards} listClass="promotion-rail-mobile__cards" />
        </div>
      </details>
    </>
  );

  if (!wrapAside) return inner;

  return (
    <aside className="shell-promo-aside" aria-label={panelTitle}>
      {inner}
    </aside>
  );
}
