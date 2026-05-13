import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "groceries.storefront.cart.v1";
const MAX_LINES = 60;

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

function newLineId(): string {
  return `ln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLine(raw: unknown): CartLine | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productId = String(o.productId ?? o.ProductId ?? "").trim();
  if (!productId) return null;
  const qty = Math.max(1, Math.min(999, Math.floor(Number(o.quantity ?? o.Quantity ?? 1)) || 1));
  return {
    lineId: String(o.lineId ?? o.LineId ?? newLineId()),
    productId,
    slug: String(o.slug ?? o.Slug ?? ""),
    titleDisplay: String(o.titleDisplay ?? o.TitleDisplay ?? ""),
    skuId: o.skuId == null || o.skuId === "" ? null : String(o.skuId),
    skuCode: o.skuCode == null || o.skuCode === "" ? null : String(o.skuCode),
    quantity: qty,
    unitPriceMinor:
      o.unitPriceMinor != null || o.UnitPriceMinor != null
        ? Number(o.unitPriceMinor ?? o.UnitPriceMinor)
        : null,
    currency: o.currency == null ? null : String(o.currency ?? o.Currency),
    heroStorageKey: o.heroStorageKey == null ? null : String(o.heroStorageKey ?? o.HeroStorageKey),
    vendorCode: o.vendorCode == null ? null : String(o.vendorCode ?? o.VendorCode),
  };
}

function readLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLine).filter((x): x is CartLine => x != null);
  } catch {
    return [];
  }
}

function writeLines(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.slice(0, MAX_LINES)));
  } catch {
    /* quota */
  }
}

type CartContextValue = {
  lines: CartLine[];
  totalQuantity: number;
  addOrMergeLine: (input: Omit<CartLine, "lineId">) => void;
  setLineQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => readLines());

  useEffect(() => {
    writeLines(lines);
    window.dispatchEvent(new CustomEvent("groceries-cart-changed", { detail: { count: lines.length } }));
  }, [lines]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readLines());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const totalQuantity = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const addOrMergeLine = useCallback((input: Omit<CartLine, "lineId">) => {
    setLines((prev) => {
      const skuKey = input.skuCode?.trim() || "";
      const idx = prev.findIndex(
        (l) =>
          l.productId === input.productId &&
          (l.skuCode?.trim() || "") === skuKey &&
          (l.skuId ?? "") === (input.skuId ?? "")
      );
      if (idx >= 0) {
        const next = [...prev];
        const merged = { ...next[idx]!, quantity: Math.min(999, next[idx]!.quantity + input.quantity) };
        next[idx] = merged;
        return next;
      }
      return [...prev, { ...input, lineId: newLineId() }];
    });
  }, []);

  const setLineQuantity = useCallback((lineId: string, quantity: number) => {
    const q = Math.max(0, Math.min(999, Math.floor(quantity)));
    setLines((prev) => {
      if (q <= 0) return prev.filter((l) => l.lineId !== lineId);
      return prev.map((l) => (l.lineId === lineId ? { ...l, quantity: q } : l));
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ lines, totalQuantity, addOrMergeLine, setLineQuantity, removeLine, clearCart }),
    [lines, totalQuantity, addOrMergeLine, setLineQuantity, removeLine, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const v = useContext(CartContext);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}
