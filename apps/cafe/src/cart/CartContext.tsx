import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext.js";
import { getCommerceTenantId } from "../dev/devTenantStore.js";
import {
  clearShopperCart,
  fetchShopperCart,
  removeShopperCartLine,
  setShopperCartLineQuantity,
  upsertShopperCartLine,
  type ShopperCartLineDto,
} from "../lib/commerceApi.js";

const LEGACY_CART_KEYS = ["sarees.storefront.cart.v1", "cafe.storefront.cart.v1"];

export type CartLine = {
  lineId: string;
  productId: string;
  slug: string;
  titleDisplay: string;
  skuId: string | null;
  skuCode: string | null;
  quantity: number;
  unitPriceMinor: number | null;
  currency: string | null;
  heroStorageKey: string | null;
  vendorCode: string | null;
};

export type CartLineInput = Omit<CartLine, "lineId">;

function fromDto(d: ShopperCartLineDto): CartLine {
  return {
    lineId: d.lineId,
    productId: d.productId,
    slug: d.slug,
    titleDisplay: d.titleDisplay,
    skuId: d.skuId,
    skuCode: d.skuCode,
    quantity: d.quantity,
    unitPriceMinor: d.unitPriceMinor,
    currency: d.currency,
    heroStorageKey: d.heroStorageKey,
    vendorCode: d.vendorCode,
  };
}

function purgeLegacyCartStorage(): void {
  try {
    for (const key of LEGACY_CART_KEYS) {
      localStorage.removeItem(key);
    }
    const prefix = "cafe.storefront.cart.v1.";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }
}

type CartContextValue = {
  tenantId: string;
  lines: CartLine[];
  loading: boolean;
  totalQuantity: number;
  addOrMergeLine: (input: CartLineInput) => Promise<void>;
  setLineQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const tenantId = getCommerceTenantId();
  const { auth, getAccessToken } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);

  const isShopperSignedIn =
    auth.status === "signedIn" && auth.role === "shopper" && Boolean(getAccessToken());

  useEffect(() => {
    purgeLegacyCartStorage();
  }, []);

  const refreshCart = useCallback(async () => {
    const token = getAccessToken();
    if (auth.status !== "signedIn" || auth.role !== "shopper" || !token) {
      setLines([]);
      return;
    }
    setLoading(true);
    try {
      const dtos = await fetchShopperCart(token);
      setLines(dtos.map(fromDto));
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [auth.status, auth.role, getAccessToken, tenantId]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart, isShopperSignedIn]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cafe-cart-changed", { detail: { count: lines.length, tenantId } })
    );
  }, [lines, tenantId]);

  const requireShopperToken = useCallback((): string => {
    const token = getAccessToken();
    if (auth.status !== "signedIn" || auth.role !== "shopper" || !token) {
      throw new Error("Sign in as a shopper to use the cart.");
    }
    return token;
  }, [auth.status, auth.role, getAccessToken]);

  const totalQuantity = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const addOrMergeLine = useCallback(
    async (input: CartLineInput) => {
      const token = requireShopperToken();
      const dtos = await upsertShopperCartLine(token, {
        productId: input.productId,
        skuId: input.skuId,
        quantity: input.quantity,
        unitPriceMinor: input.unitPriceMinor,
        currency: input.currency,
      });
      setLines(dtos.map(fromDto));
    },
    [requireShopperToken]
  );

  const setLineQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      const token = requireShopperToken();
      const q = Math.max(0, Math.min(999, Math.floor(quantity)));
      if (q <= 0) {
        await removeShopperCartLine(token, lineId);
        setLines((prev) => prev.filter((l) => l.lineId !== lineId));
        return;
      }
      const dtos = await setShopperCartLineQuantity(token, lineId, q);
      setLines(dtos.map(fromDto));
    },
    [requireShopperToken]
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      const token = requireShopperToken();
      await removeShopperCartLine(token, lineId);
      setLines((prev) => prev.filter((l) => l.lineId !== lineId));
    },
    [requireShopperToken]
  );

  const clearCart = useCallback(async () => {
    const token = requireShopperToken();
    await clearShopperCart(token);
    setLines([]);
  }, [requireShopperToken]);

  const value = useMemo(
    () => ({
      tenantId,
      lines,
      loading,
      totalQuantity,
      addOrMergeLine,
      setLineQuantity,
      removeLine,
      clearCart,
      refreshCart,
    }),
    [
      tenantId,
      lines,
      loading,
      totalQuantity,
      addOrMergeLine,
      setLineQuantity,
      removeLine,
      clearCart,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const v = useContext(CartContext);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}
