import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { AppChrome } from "./shell/AppChrome.js";
import { HomePage } from "./pages/HomePage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ShopperSignupPage } from "./pages/ShopperSignupPage.js";
import { VendorSignupPage } from "./pages/VendorSignupPage.js";
import { DocStubPage } from "./pages/DocStubPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { VendorProductsPage } from "./pages/VendorProductsPage.js";
import { CategoryBrowsePage } from "./pages/CategoryBrowsePage.js";
import { ProductDetailPage } from "./pages/ProductDetailPage.js";
import { VendorProductEditPage } from "./pages/VendorProductEditPage.js";
import { DevApiPing } from "./dev/DevApiPing.js";

import "./index.css";
import "./app-shell.css";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <DevApiPing />
        <Routes>
          <Route element={<AppChrome />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse/:categorySlug" element={<CategoryBrowsePage />} />
            <Route path="/p/:productSlug" element={<ProductDetailPage />} />
            <Route path="/productDetail/:productKey" element={<ProductDetailPage />} />
            <Route path="/cart" element={<DocStubPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup/vendor" element={<VendorSignupPage />} />
            <Route path="/signup/shopper" element={<ShopperSignupPage />} />
            <Route path="/settings" element={<DocStubPage />} />
            <Route path="/settings/notifications" element={<DocStubPage />} />
            <Route path="/account/profile" element={<ProfilePage />} />
            <Route path="/vendor/products" element={<VendorProductsPage />} />
            <Route path="/vendor/products/:productId" element={<VendorProductEditPage />} />
            <Route path="/favourites" element={<DocStubPage />} />
            <Route path="/orders" element={<DocStubPage />} />
            <Route path="/communication" element={<DocStubPage />} />
            <Route path="/support" element={<DocStubPage />} />
            <Route path="/legal/privacy" element={<DocStubPage />} />
            <Route path="/legal/terms" element={<DocStubPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
