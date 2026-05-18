/** Home category rails read tile images from `product_categories` values only. */
export const LOOKUP_TYPE_WITH_TILE_IMAGE = "product_categories";

export function lookupTypeSupportsTileImage(lookupTypeId: string): boolean {
  return lookupTypeId.trim() === LOOKUP_TYPE_WITH_TILE_IMAGE;
}

export const LOOKUP_TILE_IMAGE_BINDING = "entry.storefrontImageKey";
