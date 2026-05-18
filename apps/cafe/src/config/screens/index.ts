import type { CatalogScreenDefinition } from "@webkitfxv2/commerce-screens";
import cartScreen from "./cart.json";
import checkoutScreen from "./checkout.json";
import checkoutPaymentScreen from "./checkout-payment.json";
import homeScreen from "./home.json";
import orderConfirmationScreen from "./order-confirmation.json";
import ordersScreen from "./orders.json";
import orderTrackingScreen from "./order-tracking.json";
import productDetailScreen from "./product-detail.json";
import vendorOrdersScreen from "./vendor-orders.json";
import tableManagementScreen from "./table-management.json";
import floorPlanScreen from "./floor-plan.json";
import qrTableScreen from "./qr-table.json";

export type AppScreenDefinition = CatalogScreenDefinition | { copy: Record<string, string> };

export const screenDefinitions: Record<string, AppScreenDefinition> = {
  home: homeScreen as AppScreenDefinition,
  cart: cartScreen as AppScreenDefinition,
  checkout: checkoutScreen as AppScreenDefinition,
  checkoutPayment: checkoutPaymentScreen as AppScreenDefinition,
  orderConfirmation: orderConfirmationScreen as AppScreenDefinition,
  orders: ordersScreen as AppScreenDefinition,
  orderTracking: orderTrackingScreen as AppScreenDefinition,
  vendorOrders: vendorOrdersScreen as AppScreenDefinition,
  tableManagement: tableManagementScreen as AppScreenDefinition,
  floorPlan: floorPlanScreen as AppScreenDefinition,
  qrTable: qrTableScreen as AppScreenDefinition,
  productDetail: productDetailScreen as CatalogScreenDefinition,
};
