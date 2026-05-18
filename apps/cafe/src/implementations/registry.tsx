import type { ImplementationRegistry } from "@webkitfxv2/commerce-screens";
import { AdminOrdersPage } from "../pages/AdminOrdersPage.js";
import { AdminPortalUsersPage } from "../pages/AdminPortalUsersPage.js";
import { CartPage } from "../pages/CartPage.js";
import { CategoryBrowsePage } from "../pages/CategoryBrowsePage.js";
import { ChangePasswordPage } from "../pages/ChangePasswordPage.js";
import { CheckoutPage } from "../pages/CheckoutPage.js";
import { CheckoutPaymentPage } from "../pages/CheckoutPaymentPage.js";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage.js";
import { HomePage } from "../pages/HomePage.js";
import { LoginPage } from "../pages/LoginPage.js";
import { LookupAdminPage } from "../pages/LookupAdminPage.js";
import { OrderConfirmationPage } from "../pages/OrderConfirmationPage.js";
import { OrdersPage } from "../pages/OrdersPage.js";
import { OrderTrackingPage } from "../pages/OrderTrackingPage.js";
import { ProductDetailPage } from "../pages/ProductDetailPage.js";
import { ProfilePage } from "../pages/ProfilePage.js";
import { SearchPage } from "../pages/SearchPage.js";
import { ShopperSignupPage } from "../pages/ShopperSignupPage.js";
import { StorefrontSponsoredAdsAdminPage } from "../pages/StorefrontSponsoredAdsAdminPage.js";
import { VendorOrdersPage } from "../pages/VendorOrdersPage.js";
import { VendorProductEditPage } from "../pages/VendorProductEditPage.js";
import { VendorProductStorefrontPage } from "../pages/VendorProductStorefrontPage.js";
import { VendorProductsPage } from "../pages/VendorProductsPage.js";
import { QrTableMenuPage } from "../pages/QrTableMenuPage.js";
import { TableManagementPage } from "../pages/TableManagementPage.js";
import { TableFloorPlanPage } from "../pages/TableFloorPlanPage.js";
import { VendorSignupPage } from "../pages/VendorSignupPage.js";

function AdminVendorsPage() {
  return <AdminPortalUsersPage directory="vendors" />;
}

function AdminShoppersPage() {
  return <AdminPortalUsersPage directory="shoppers" />;
}

/** Route manifest `implementation` id → screen component. Copy lives in JSON only. */
export const implementationRegistry: ImplementationRegistry = {
  home: HomePage,
  qrTableMenu: QrTableMenuPage,
  categoryBrowse: CategoryBrowsePage,
  productDetail: ProductDetailPage,
  cart: CartPage,
  checkout: CheckoutPage,
  checkoutPayment: CheckoutPaymentPage,
  orderConfirmation: OrderConfirmationPage,
  search: SearchPage,
  login: LoginPage,
  forgotPassword: ForgotPasswordPage,
  changePassword: ChangePasswordPage,
  vendorSignup: VendorSignupPage,
  shopperSignup: ShopperSignupPage,
  profile: ProfilePage,
  vendorProducts: VendorProductsPage,
  vendorProductStorefront: VendorProductStorefrontPage,
  vendorProductEdit: VendorProductEditPage,
  lookupAdmin: LookupAdminPage,
  storefrontAdsAdmin: StorefrontSponsoredAdsAdminPage,
  adminVendors: AdminVendorsPage,
  adminShoppers: AdminShoppersPage,
  adminOrders: AdminOrdersPage,
  orders: OrdersPage,
  orderTracking: OrderTrackingPage,
  vendorOrders: VendorOrdersPage,
  tableManagement: TableManagementPage,
  tableFloorPlan: TableFloorPlanPage,
};
