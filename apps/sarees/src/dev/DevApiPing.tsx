import { useEffect } from "react";
import { commerceTenantHeaders } from "../lib/commerceApi.js";

/**
 * In development, fires one anonymous catalog request after mount so DevTools Network
 * shows a proxied `/api/...` call (confirms Vite → Commerce.Api). The home page itself
 * has no other API traffic until login or vendor routes.
 */
export function DevApiPing() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      void fetch("/api/v1/catalog/categories", {
        headers: commerceTenantHeaders(),
        signal: ac.signal,
      })
        .then((res) => {
          console.info(
            `[SareeCart dev] GET /api/v1/catalog/categories → ${res.status}. You should see this in the Network tab (type: fetch or xhr).`
          );
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === "AbortError") return;
          console.warn(
            "[SareeCart dev] API ping failed. Start Commerce.Api on :5055 and use the Vite dev URL (http://localhost:…), not file://.",
            err
          );
        });
    }, 300);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, []);
  return null;
}
