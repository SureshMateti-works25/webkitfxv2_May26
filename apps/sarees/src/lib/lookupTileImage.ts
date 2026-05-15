/** Commerce.Api stores an optional tile image on every lookup value (`imageStorageKey`). */
export function lookupTypeSupportsTileImage(lookupTypeId: string): boolean {
  return lookupTypeId.trim().length > 0;
}

export const LOOKUP_TILE_IMAGE_BINDING = "entry.storefrontImageKey";
