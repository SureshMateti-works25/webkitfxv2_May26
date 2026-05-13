import { useEffect } from "react";
import { commerceTenantHeaders } from "../lib/commerceApi.js";

/** Dev-only: one proxied catalog request so Network shows `/api` → Commerce.Api. */
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
            `[Groceries dev] GET /api/v1/catalog/categories → ${res.status}. Check Network for the proxied call.`
          );
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === "AbortError") return;
          console.warn(
            "[Groceries dev] API ping failed. Start Commerce.Api on :5055 and open this app over http://localhost:5183.",
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
