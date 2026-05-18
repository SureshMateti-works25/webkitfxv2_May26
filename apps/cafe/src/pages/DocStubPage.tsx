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

export function DocStubPage() {
  const { pathname } = useLocation();
  const shell = getShell();
  const key: StubScreenKey = ROUTE_TO_SCREEN[pathname] ?? "settings";
  const copy = shell.screens[key];
  return (
    <div className="screen-prose">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
    </div>
  );
}
