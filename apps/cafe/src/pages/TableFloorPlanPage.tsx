import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getScreenConfig } from "../config/getScreenConfig.js";
import {
  fetchCafeFloorPlan,
  formatCommerceApiError,
  fulfillmentStatusLabel,
  type CafeFloorPlan,
  type FloorSection,
  type FloorTable,
} from "../lib/floorPlanApi.js";
import { formatMinor } from "../lib/ordersApi.js";
import { orderChannelLabel } from "../lib/orderTableDisplay.js";

const REFRESH_MS = 30_000;

function SectionIcon({ kind }: { kind: FloorSection["visualKind"] }) {
  if (kind === "indoor") {
    return (
      <svg className="floor-plan-section__icon" viewBox="0 0 24 24" width={22} height={22} aria-hidden>
        <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
      </svg>
    );
  }
  if (kind === "outdoor") {
    return (
      <svg className="floor-plan-section__icon" viewBox="0 0 24 24" width={22} height={22} aria-hidden>
        <path
          fill="currentColor"
          d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7 1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91 1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"
        />
      </svg>
    );
  }
  return (
    <svg className="floor-plan-section__icon" viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <path fill="currentColor" d="M4 8h16v2H4V8zm0 5h10v2H4v-2zm14 0h2v2h-2v-2zM4 18h7v2H4v-2zm11 0h5v2h-5v-2z" />
    </svg>
  );
}

function TableTile({
  table,
  onSelectOrder,
}: {
  table: FloorTable;
  onSelectOrder: (orderId: string) => void;
}) {
  const occupied = table.status === "occupied";
  const primary = table.activeOrders[0];

  return (
    <article
      className={[
        "floor-plan-table",
        occupied ? "floor-plan-table--occupied" : "floor-plan-table--vacant",
      ].join(" ")}
      aria-label={`${table.label}, ${occupied ? "occupied" : "vacant"}`}
    >
      <div className="floor-plan-table__head">
        <span className="floor-plan-table__code">{table.code}</span>
        <span
          className={[
            "floor-plan-table__badge",
            occupied ? "floor-plan-table__badge--occupied" : "floor-plan-table__badge--vacant",
          ].join(" ")}
        >
          {occupied ? "Occupied" : "Vacant"}
        </span>
      </div>
      <p className="floor-plan-table__name">{table.label}</p>
      <p className="floor-plan-table__meta">{table.seats} seats</p>
      {occupied && primary ? (
        <div className="floor-plan-table__order">
          <button
            type="button"
            className="floor-plan-table__order-btn"
            onClick={() => onSelectOrder(primary.id)}
          >
            <span className="floor-plan-table__order-id">{primary.id}</span>
            <span className="floor-plan-table__order-detail">
              {orderChannelLabel(primary.orderChannel)} ·{" "}
              {fulfillmentStatusLabel(primary.fulfillmentStatus)}
            </span>
            <span className="floor-plan-table__order-amount">
              {formatMinor(primary.totalMinor, primary.currency)}
            </span>
          </button>
          {table.activeOrders.length > 1 ? (
            <p className="floor-plan-table__more">
              +{table.activeOrders.length - 1} more order
              {table.activeOrders.length > 2 ? "s" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function FloorSectionPanel({
  section,
  onSelectOrder,
}: {
  section: FloorSection;
  onSelectOrder: (orderId: string) => void;
}) {
  const copy = getScreenConfig("floorPlan");
  return (
    <section
      className={["floor-plan-section", `floor-plan-section--${section.visualKind}`].join(" ")}
      aria-labelledby={`floor-section-${section.id}`}
    >
      <header className="floor-plan-section__header">
        <div className="floor-plan-section__title-row">
          <SectionIcon kind={section.visualKind} />
          <h2 id={`floor-section-${section.id}`} className="floor-plan-section__title">
            {section.label}
          </h2>
        </div>
        <p className="floor-plan-section__stats">
          <span>{section.stats.occupied} occupied</span>
          <span aria-hidden> · </span>
          <span>{section.stats.vacant} vacant</span>
          <span aria-hidden> · </span>
          <span>{section.stats.total} tables</span>
        </p>
      </header>
      {section.tables.length === 0 ? (
        <p className="floor-plan-section__empty">{String(copy.noTablesInSection ?? "")}</p>
      ) : (
        <div className="floor-plan-section__grid" role="list">
          {section.tables.map((t) => (
            <div key={t.id} role="listitem">
              <TableTile table={t} onSelectOrder={onSelectOrder} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TableFloorPlanPage() {
  const copy = getScreenConfig("floorPlan");
  const { auth, getAccessToken } = useAuth();
  const [floor, setFloor] = useState<CafeFloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const role =
    auth.status === "signedIn" && (auth.role === "vendor" || auth.role === "admin")
      ? auth.role
      : null;

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !role) return;
    setError(null);
    try {
      const data = await fetchCafeFloorPlan(token, role);
      setFloor(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(formatCommerceApiError(e));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, role]);

  useEffect(() => {
    if (!role) return;
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, role]);

  const onSelectOrder = (orderId: string) => {
    window.location.href = `/vendor/orders?order=${encodeURIComponent(orderId)}`;
  };

  if (auth.status !== "signedIn" || !role) {
    return <Navigate to="/login" replace />;
  }

  const hasSections = (floor?.sections.length ?? 0) > 0;

  return (
    <div className="floor-plan-page">
      <header className="floor-plan-page__header">
        <h1 className="floor-plan-page__title">{String(copy.title ?? "Floor plan")}</h1>
        <p className="floor-plan-page__lede">{String(copy.lede ?? "")}</p>
        <div className="floor-plan-page__toolbar">
          <div className="floor-plan-legend" aria-label="Table status legend">
            <span className="floor-plan-legend__item floor-plan-legend__item--vacant">
              {String(copy.legendVacant ?? "Vacant")}
            </span>
            <span className="floor-plan-legend__item floor-plan-legend__item--occupied">
              {String(copy.legendOccupied ?? "Occupied")}
            </span>
          </div>
          <div className="floor-plan-page__actions">
            <button
              type="button"
              className="shell-btn shell-btn--outline"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              {String(copy.refreshLabel ?? "Refresh")}
            </button>
            <Link to="/vendor/tables" className="shell-btn shell-btn--ghost">
              {String(copy.manageTablesLink ?? "Manage tables")}
            </Link>
            <Link to="/vendor/orders" className="shell-btn shell-btn--ghost">
              {String(copy.kitchenQueueLink ?? "Kitchen queue")}
            </Link>
          </div>
        </div>
        <p className="floor-plan-page__hint">
          {String(copy.autoRefreshHint ?? "")}
          {lastRefresh ? ` · Last updated ${lastRefresh.toLocaleTimeString()}` : ""}
        </p>
      </header>

      {error ? (
        <p className="storefront-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !floor ? (
        <p className="storefront-loading">Loading floor plan…</p>
      ) : !hasSections ? (
        <div className="floor-plan-page__empty">
          <p>{String(copy.emptySections ?? "")}</p>
          <Link to="/vendor/tables" className="cart-page__cta">
            {String(copy.emptySectionsCta ?? "Set up tables")}
          </Link>
        </div>
      ) : (
        <div className="floor-plan-page__sections">
          {floor!.sections.map((section) => (
            <FloorSectionPanel key={section.id} section={section} onSelectOrder={onSelectOrder} />
          ))}
        </div>
      )}

      {floor && floor.unmappedActiveOrders.length > 0 ? (
        <section className="floor-plan-unmapped" aria-labelledby="floor-unmapped-heading">
          <h2 id="floor-unmapped-heading" className="floor-plan-unmapped__title">
            {String(copy.unmappedTitle ?? "Unmapped orders")}
          </h2>
          <ul className="floor-plan-unmapped__list">
            {floor.unmappedActiveOrders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="floor-plan-unmapped__btn"
                  onClick={() => onSelectOrder(o.id)}
                >
                  <strong>Table {o.tableCode ?? "—"}</strong>
                  <span>
                    {o.id} · {orderChannelLabel(o.orderChannel)} ·{" "}
                    {fulfillmentStatusLabel(o.fulfillmentStatus)}
                  </span>
                  <span>{formatMinor(o.totalMinor, o.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
