import { Link } from "react-router-dom";
import { mediaAssetUrl, type CommerceSponsoredProductPublic } from "../lib/commerceApi.js";

function formatMinor(minor: number | null, currency: string | null): string {
  if (minor == null) return "—";
  const major = minor / 100;
  const cur = (currency ?? "INR").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
      major
    );
  } catch {
    return `${cur} ${major.toFixed(0)}`;
  }
}

export type SponsoredVendorRailProps = {
  items: CommerceSponsoredProductPublic[];
  panelTitle: string;
  mobileSummary: string;
};

function SponsorCard({ item }: { item: CommerceSponsoredProductPublic }) {
  const href = `/p/${encodeURIComponent(item.slug)}`;
  const img =
    item.heroStorageKey && item.heroStorageKey.length > 0 ? (
      <img
        className="sponsor-card__img"
        src={mediaAssetUrl(item.heroStorageKey)}
        alt=""
        loading="lazy"
        decoding="async"
      />
    ) : (
      <div className="sponsor-card__img sponsor-card__img--placeholder" aria-hidden />
    );

  return (
    <li className="sponsor-card">
      <Link to={href} className="sponsor-card__link">
        {img}
        {item.label ? <p className="sponsor-card__eyebrow">{item.label}</p> : null}
        <h3 className="sponsor-card__title">{item.titleDisplay}</h3>
        <p className="sponsor-card__price">{formatMinor(item.minPriceMinor, item.currency)}</p>
        <span className="sponsor-card__cta">View product</span>
      </Link>
    </li>
  );
}

/**
 * Sponsored product mini-cards for the in-page right column (desktop) + collapsible block (mobile).
 */
export function SponsoredVendorRail({ items, panelTitle, mobileSummary }: SponsoredVendorRailProps) {
  if (items.length === 0) return null;

  return (
    <>
      <section className="sponsor-rail sponsor-rail--embedded sponsor-rail--lg-up" aria-labelledby="sponsor-rail-heading-desk">
        <h2 id="sponsor-rail-heading-desk" className="sponsor-rail__title">
          {panelTitle}
        </h2>
        <ul className="sponsor-rail__list">
          {items.map((it) => (
            <SponsorCard key={it.id} item={it} />
          ))}
        </ul>
      </section>

      <details className="sponsor-rail-mobile sponsor-rail-mobile--embedded sponsor-rail--sm-down">
        <summary className="sponsor-rail-mobile__summary">{mobileSummary}</summary>
        <div className="sponsor-rail-mobile__panel">
          <h2 id="sponsor-rail-heading-mob" className="sponsor-rail__title sponsor-rail__title--in-panel">
            {panelTitle}
          </h2>
          <ul className="sponsor-rail-mobile__list">
            {items.map((it) => (
              <SponsorCard key={it.id} item={it} />
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}
