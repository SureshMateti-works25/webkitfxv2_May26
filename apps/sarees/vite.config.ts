import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Commerce.Api — use 127.0.0.1 so it matches dev storefront `VITE_*` defaults and IPv4 resolution on Windows. */
const commerceApiOrigin = "http://127.0.0.1:5055";

const onProxyErr = (label: string) => (err: Error) => {
  console.error(
    `[vite] ${label} -> ${commerceApiOrigin} failed (is Commerce.Api running on 5055?):`,
    err.message
  );
};

const apiProxy = {
  "/api": {
    target: commerceApiOrigin,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("error", onProxyErr("/api proxy"));
    }
  },
  "/media": {
    target: commerceApiOrigin,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("error", onProxyErr("/media proxy"));
    }
  }
} as const;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    open: true,
    proxy: { ...apiProxy }
  },
  // `vite preview` does not use `server.proxy` unless repeated here — without it,
  // http://localhost:<port>/api/... returns 404 from the static preview server.
  preview: {
    port: 5175,
    proxy: { ...apiProxy }
  }
});
