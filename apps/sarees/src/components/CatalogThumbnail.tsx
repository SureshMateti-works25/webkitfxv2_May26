import { useState } from "react";
import { mediaAssetUrl } from "../lib/commerceApi.js";

type Props = {
  storageKey: string | null | undefined;
  alt?: string;
  className?: string;
  /** Applied to the wrapper; image fills it */
  mediaClassName?: string;
};

/**
 * Product card / rail thumbnail: resolves /media via Vite proxy, shows placeholder on missing key or load error.
 */
export function CatalogThumbnail({ storageKey, alt = "", className = "", mediaClassName = "" }: Props) {
  const [broken, setBroken] = useState(false);
  const trimmed = storageKey?.trim() ?? "";
  const src = trimmed.length > 0 && !broken ? mediaAssetUrl(trimmed) : null;

  return (
    <div className={`catalog-thumb ${className}`.trim()}>
      <div className={`catalog-thumb__media ${mediaClassName}`.trim()}>
        {src ? (
          <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="catalog-thumb__img" />
        ) : null}
      </div>
    </div>
  );
}
