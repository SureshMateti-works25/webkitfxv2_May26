import { useLocation } from "react-router-dom";
import { getShell } from "../config/getShell.js";
import type { ShellConfig } from "../config/shell.types.js";

type StubScreenKey = keyof Pick<
  ShellConfig["screens"],
  | "settings"
  | "support"
  | "legalPrivacy"
  | "legalTerms"
  | "cart"
  | "favourites"
  | "orders"
  | "communication"
  | "adminOrders"
>;

const ROUTE_TO_SCREEN: Record<string, StubScreenKey> = {
  "/settings": "settings",
  "/settings/notifications": "settings",
  "/support": "support",
  "/legal/privacy": "legalPrivacy",
  "/legal/terms": "legalTerms",
  "/cart": "cart",
  "/favourites": "favourites",
  "/orders": "orders",
  "/communication": "communication",
  "/admin/orders": "adminOrders"
};

const PORTAL_STUBS: Record<string, { title: string; body: string }> = {
  "/admin/lookups": {
    title: "Lookup administration",
    body: "Lookup maintenance UI is bundled with the sarees-market app at /admin/lookups. This groceries preview shares the same API and tenant.",
  },
  "/admin/storefront-ads": {
    title: "Sponsored storefront",
    body: "Configure sponsored rails from the sarees-market admin route /admin/storefront-ads on the same Commerce.Api.",
  },
  "/admin/vendors": {
    title: "Vendors",
    body: "Directory admin screens are available from the sarees-market app on the same backend.",
  },
  "/admin/shoppers": {
    title: "Shoppers",
    body: "Directory admin screens are available from the sarees-market app on the same backend.",
  },
};

export function DocStubPage() {
  const { pathname } = useLocation();
  const shell = getShell();
  const stub = PORTAL_STUBS[pathname];
  if (stub) {
    return (
      <div className="screen-prose">
        <h1>{stub.title}</h1>
        <p>{stub.body}</p>
      </div>
    );
  }
  const key: StubScreenKey = ROUTE_TO_SCREEN[pathname] ?? "settings";
  const copy = shell.screens[key];
  return (
    <div className="screen-prose">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
    </div>
  );
}
