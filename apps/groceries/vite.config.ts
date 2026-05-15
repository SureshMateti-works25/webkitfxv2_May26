import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
    },
  },
  "/media": {
    target: commerceApiOrigin,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("error", onProxyErr("/media proxy"));
    },
  },
} as const;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    open: true,
    proxy: { ...apiProxy },
  },
  preview: {
    port: 5183,
    proxy: { ...apiProxy },
  },
});
