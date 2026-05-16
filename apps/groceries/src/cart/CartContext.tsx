import { useAuth } from "../auth/AuthContext.js";
import {
  clearShopperCart,
  fetchShopperCart,
  removeShopperCartLine,
  setShopperCartLineQuantity,
  upsertShopperCartLine,
  type ShopperCartLineDto,
} from "../lib/commerceApi.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LEGACY_CART_STORAGE_KEY = "groceries.storefront.cart.v1";

export type CartLineInput = {
  lineId?: string;
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
  packLabel?: string | null;
  packUnitType?: string | null;
  packQuantity?: number | null;
  unitsPerPack?: number | null;
};

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
  packLabel: string | null;
  packUnitType: string | null;
  packQuantity: number | null;
  unitsPerPack: number | null;
};

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
    packLabel: d.packLabel,
    packUnitType: d.packUnitType,
    packQuantity: d.packQuantity,
    unitsPerPack: d.unitsPerPack,
  };
}

function purgeLegacyCartStorage(): void {
  try {
    localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

type CartContextValue = {
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
  }, [auth.status, auth.role, getAccessToken]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart, isShopperSignedIn]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("groceries-cart-changed", { detail: { count: lines.length } })
    );
  }, [lines]);

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
        packLabel: input.packLabel,
        packUnitType: input.packUnitType,
        packQuantity: input.packQuantity,
        unitsPerPack: input.unitsPerPack,
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
