import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.js";
import { CartProvider } from "./cart/CartContext.js";
import { AppChrome } from "./shell/AppChrome.js";
import { HomePage } from "./pages/HomePage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { ChangePasswordPage } from "./pages/ChangePasswordPage.js";
import { ShopperSignupPage } from "./pages/ShopperSignupPage.js";
import { VendorSignupPage } from "./pages/VendorSignupPage.js";
import { CartPage } from "./pages/CartPage.js";
import { CheckoutPage } from "./pages/CheckoutPage.js";
import { CheckoutPaymentPage } from "./pages/CheckoutPaymentPage.js";
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage.js";
import { OrdersPage } from "./pages/OrdersPage.js";
import { OrderTrackingPage } from "./pages/OrderTrackingPage.js";
import { VendorOrdersPage } from "./pages/VendorOrdersPage.js";
import { AdminOrdersPage } from "./pages/AdminOrdersPage.js";
import { DocStubPage } from "./pages/DocStubPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { VendorProductsPage } from "./pages/VendorProductsPage.js";
import { CategoryBrowsePage } from "./pages/CategoryBrowsePage.js";
import { ProductDetailPage } from "./pages/ProductDetailPage.js";
import { VendorProductEditPage } from "./pages/VendorProductEditPage.js";
import { VendorProductStorefrontPage } from "./pages/VendorProductStorefrontPage.js";
import { LookupAdminPage } from "./pages/LookupAdminPage.js";
import { StorefrontSponsoredAdsAdminPage } from "./pages/StorefrontSponsoredAdsAdminPage.js";
import { AdminPortalUsersPage } from "./pages/AdminPortalUsersPage.js";
import { SearchPage } from "./pages/SearchPage.js";
import { DevApiPing } from "./dev/DevApiPing.js";

import "./index.css";
import "./app-shell.css";

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <DevApiPing />
          <Routes>
            <Route element={<AppChrome />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/browse/:categorySlug" element={<CategoryBrowsePage />} />
              <Route path="/p/:productSlug" element={<ProductDetailPage />} />
              <Route path="/productDetail/:productKey" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/checkout/payment" element={<CheckoutPaymentPage />} />
              <Route path="/checkout/confirmation/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/account/change-password" element={<ChangePasswordPage />} />
              <Route path="/signup/vendor" element={<VendorSignupPage />} />
              <Route path="/signup/shopper" element={<ShopperSignupPage />} />
              <Route path="/settings" element={<DocStubPage />} />
              <Route path="/settings/notifications" element={<DocStubPage />} />
              <Route path="/account/profile" element={<ProfilePage />} />
              <Route path="/vendor/products" element={<VendorProductsPage />} />
              <Route path="/vendor/products/:productId/storefront" element={<VendorProductStorefrontPage />} />
              <Route path="/vendor/products/:productId" element={<VendorProductEditPage />} />
              <Route path="/admin/lookups" element={<LookupAdminPage />} />
              <Route path="/admin/storefront-ads" element={<StorefrontSponsoredAdsAdminPage />} />
              <Route path="/admin/vendors" element={<AdminPortalUsersPage directory="vendors" />} />
              <Route path="/admin/shoppers" element={<AdminPortalUsersPage directory="shoppers" />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/favourites" element={<DocStubPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/track" element={<OrderTrackingPage />} />
              <Route path="/orders/track/:orderId" element={<OrderTrackingPage />} />
              <Route path="/vendor/orders" element={<VendorOrdersPage />} />
              <Route path="/communication" element={<DocStubPage />} />
              <Route path="/support" element={<DocStubPage />} />
              <Route path="/legal/privacy" element={<DocStubPage />} />
              <Route path="/legal/terms" element={<DocStubPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
