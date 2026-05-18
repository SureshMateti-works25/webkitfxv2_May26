import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getShell } from "../config/getShell.js";
import { getVisiblePromotionCards, resolveEdgeChromeAudience } from "../lib/edgeChromeVisibility.js";
import {
  listCommerceSponsoredStorefront,
  type CommerceSponsoredProductPublic,
} from "../lib/commerceApi.js";
import { QrOrderBanner } from "../components/QrOrderBanner.js";
import { useQrOrderSession } from "../lib/qrOrderSession.js";
import { PromotionSidebar } from "./PromotionSidebar.js";
import { SponsoredVendorRail } from "./SponsoredVendorRail.js";

/**
 * Main outlet + embedded offers column (desktop) / in-flow collapsible offers (mobile).
 * Avoids fixed overlays that fight with IDE or in-app right panels.
 */
export function ShellBodyWithPromo() {
  const shell = getShell();
  const edge = shell.edgeChrome;
  const { pathname } = useLocation();
  const qrSession = useQrOrderSession();
  const showQrBanner =
    qrSession != null && !pathname.startsWith("/qr") && !pathname.startsWith("/checkout");
  const { auth } = useAuth();
  const audience = useMemo(() => resolveEdgeChromeAudience(auth), [auth]);

  const promoCards = useMemo(() => {
    if (!edge || edge.enabled === false) return [];
    return getVisiblePromotionCards(edge.promotionRail, pathname, audience);
  }, [edge, pathname, audience]);

  const [sponsored, setSponsored] = useState<CommerceSponsoredProductPublic[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    listCommerceSponsoredStorefront()
      .then((rows) => {
        if (!cancelled) setSponsored(rows);
      })
      .catch(() => {
        if (!cancelled) setSponsored([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sponsorResolved = sponsored !== undefined;
  const twoCol = promoCards.length > 0 || (sponsorResolved && sponsored.length > 0);
  const rail = edge?.promotionRail;
  const showPromoBlock = promoCards.length > 0 && !!rail;
  const showSponsorBlock = sponsorResolved && sponsored.length > 0;

  return (
    <div className={`shell-page-with-promo${twoCol ? " shell-page-with-promo--cols" : ""}`}>
      <main className="shell-body">
        {showQrBanner ? <QrOrderBanner /> : null}
        <Outlet />
      </main>
      {twoCol ? (
        <aside
          className={`shell-promo-aside${showPromoBlock && showSponsorBlock ? " shell-promo-aside--stack" : ""}`}
          aria-label="Offers and sponsored catalogue"
        >
          {showPromoBlock && rail ? (
            <PromotionSidebar
              wrapAside={false}
              panelTitle={rail.title ?? "Offers"}
              summaryLabel={rail.mobileToggleLabel ?? rail.title ?? "Offers"}
              cards={promoCards}
            />
          ) : null}
          {showSponsorBlock && sponsored && sponsored.length > 0 ? (
            <SponsoredVendorRail
              items={sponsored}
              panelTitle="Sponsored picks"
              mobileSummary="Sponsored picks"
            />
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
