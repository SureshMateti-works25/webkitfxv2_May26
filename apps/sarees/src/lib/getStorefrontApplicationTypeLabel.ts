import { getShell } from "../config/getShell.js";
import { CATALOG_APPLICATION_TYPE_LOOKUP_ID, listCommerceLookupValues } from "./commerceApi.js";

export function storefrontApplicationTypeLabelFromConfig(): string {
  const app = getShell().app;
  const configured = app.applicationTypeLabel?.trim();
  if (configured) return configured;

  const id = CATALOG_APPLICATION_TYPE_LOOKUP_ID.trim();
  if (id === "app_cafe") return "Café";
  if (id === "app_sr") return "Sarees";
  if (id === "app_gr") return "Groceries";
  if (id.startsWith("app_")) {
    const tail = id.slice(4);
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  }
  return "Sarees";
}

export async function fetchStorefrontApplicationTypeLabel(): Promise<string> {
  const fallback = storefrontApplicationTypeLabelFromConfig();
  try {
    const rows = await listCommerceLookupValues("application_type");
    const configured = CATALOG_APPLICATION_TYPE_LOOKUP_ID.trim();
    const row =
      rows.find((r) => r.id === configured) ??
      (configured === "app_sr"
        ? rows.find(
            (r) =>
              r.code.trim().toLowerCase() === "sr" ||
              /saree/i.test(r.label) ||
              /saree/i.test(r.code)
          )
        : undefined);
    return row?.label.trim() || fallback;
  } catch {
    return fallback;
  }
}
