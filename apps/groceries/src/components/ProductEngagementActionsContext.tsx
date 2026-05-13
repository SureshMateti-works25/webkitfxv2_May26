import { createContext, useContext } from "react";

export type ProductEngagementPanelId =
  | "votes"
  | "favorite"
  | "comments"
  | "share"
  | "about"
  | "flag";

export type ProductEngagementActionsValue = {
  productId: string;
  onRefresh: () => Promise<void>;
  activePanel: ProductEngagementPanelId | null;
  togglePanel: (id: ProductEngagementPanelId) => void;
  favorite: boolean;
  setFavorite: (next: boolean) => void;
};

export const ProductEngagementActionsContext = createContext<ProductEngagementActionsValue | null>(null);

export function useProductEngagementActions(): ProductEngagementActionsValue | null {
  return useContext(ProductEngagementActionsContext);
}
