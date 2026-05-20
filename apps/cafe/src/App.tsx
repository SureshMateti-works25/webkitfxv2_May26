import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createRouteElements } from "@webkitfxv2/commerce-screens";
import { AuthProvider } from "./auth/AuthContext.js";
import { CartProvider } from "./cart/CartContext.js";
import { getRoutes } from "./config/getRoutes.js";
import { getScreenConfig } from "./config/getScreenConfig.js";
import { getForm } from "./config/forms/index.js";
import { implementationRegistry } from "./implementations/registry.js";
import { AppChrome } from "./shell/AppChrome.js";
import { DevApiPing } from "./dev/DevApiPing.js";
import { DevTenantSwitcher } from "./dev/DevTenantSwitcher.js";
import { TenantChromeProvider } from "./lib/useTenantChrome.js";

import "./index.css";
import "./app-shell.css";
import "./cafe-theme.css";

const routeElements = createRouteElements({
  manifest: getRoutes(),
  implementations: implementationRegistry,
  resolveScreenCopy: (screenKey) => getScreenConfig(screenKey),
  resolveForm: (formId) => getForm(formId),
});

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <TenantChromeProvider>
            {import.meta.env.DEV ? (
              <>
                <DevApiPing />
                <DevTenantSwitcher />
              </>
            ) : null}
            <Routes>
              <Route element={<AppChrome />}>{routeElements}</Route>
            </Routes>
          </TenantChromeProvider>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
