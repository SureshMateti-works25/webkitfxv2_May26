import type { RouteManifest } from "@webkitfxv2/commerce-screens";
import routesJson from "./routes.json";

export function getRoutes(): RouteManifest {
  return routesJson as RouteManifest;
}
