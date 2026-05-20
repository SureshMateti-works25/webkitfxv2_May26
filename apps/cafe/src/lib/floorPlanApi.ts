import { commerceTenantHeaders, getDefaultCommerceTenantId, formatCommerceApiError } from "./commerceApi.js";

const BASE =
  (import.meta.env.VITE_COMMERCE_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.VITE_CATALOG_API_URL as string | undefined)?.trim().replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:5055" : "http://localhost:5055");

export type FloorTableStatus = "vacant" | "occupied";

export type FloorActiveOrder = {
  id: string;
  tableCode: string | null;
  orderChannel: string | null;
  fulfillmentStatus: string;
  totalMinor: number;
  currency: string;
  placedAt: string;
  statusUpdatedAt: string;
};

export type FloorTable = {
  id: string;
  code: string;
  label: string;
  seats: number;
  sectionId: string | null;
  status: FloorTableStatus;
  activeOrders: FloorActiveOrder[];
};

export type FloorSectionVisualKind = "indoor" | "outdoor" | "bar" | "other";

export type FloorSection = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  visualKind: FloorSectionVisualKind;
  stats: { total: number; occupied: number; vacant: number };
  tables: FloorTable[];
};

export type CafeFloorPlan = {
  sections: FloorSection[];
  unmappedActiveOrders: FloorActiveOrder[];
  activeOrderCount: number;
};

function authHeaders(token: string): HeadersInit {
  return {
    ...commerceTenantHeaders(),
    Authorization: `Bearer ${token}`,
    "X-Tenant-Id": getDefaultCommerceTenantId(),
  };
}

function normalizeOrder(row: Record<string, unknown>): FloorActiveOrder {
  return {
    id: String(row.id ?? ""),
    tableCode:
      row.tableCode == null && row.TableCode == null
        ? null
        : String(row.tableCode ?? row.TableCode ?? "").trim() || null,
    orderChannel:
      row.orderChannel == null && row.OrderChannel == null
        ? null
        : String(row.orderChannel ?? row.OrderChannel ?? "").trim() || null,
    fulfillmentStatus: String(row.fulfillmentStatus ?? row.FulfillmentStatus ?? ""),
    totalMinor: Number(row.totalMinor ?? row.TotalMinor ?? 0),
    currency: String(row.currency ?? row.Currency ?? "INR"),
    placedAt: String(row.placedAt ?? row.PlacedAt ?? ""),
    statusUpdatedAt: String(row.statusUpdatedAt ?? row.StatusUpdatedAt ?? ""),
  };
}

function normalizeTable(row: Record<string, unknown>): FloorTable {
  const ordersRaw = row.activeOrders ?? row.ActiveOrders;
  const activeOrders = Array.isArray(ordersRaw)
    ? ordersRaw
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map(normalizeOrder)
    : [];
  const statusRaw = String(row.status ?? row.Status ?? "vacant").toLowerCase();
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? row.Code ?? ""),
    label: String(row.label ?? row.Label ?? ""),
    seats: Number(row.seats ?? row.Seats ?? 0),
    sectionId:
      row.sectionId == null && row.SectionId == null
        ? null
        : String(row.sectionId ?? row.SectionId ?? "").trim() || null,
    status: statusRaw === "occupied" ? "occupied" : "vacant",
    activeOrders,
  };
}

function normalizeSection(row: Record<string, unknown>): FloorSection {
  const statsRaw = (row.stats ?? row.Stats) as Record<string, unknown> | undefined;
  const tablesRaw = row.tables ?? row.Tables;
  const visual = String(row.visualKind ?? row.VisualKind ?? "other").toLowerCase();
  const visualKind: FloorSectionVisualKind =
    visual === "indoor" || visual === "outdoor" || visual === "bar" ? visual : "other";

  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? row.Code ?? ""),
    label: String(row.label ?? row.Label ?? ""),
    sortOrder: Number(row.sortOrder ?? row.SortOrder ?? 0),
    visualKind,
    stats: {
      total: Number(statsRaw?.total ?? statsRaw?.Total ?? 0),
      occupied: Number(statsRaw?.occupied ?? statsRaw?.Occupied ?? 0),
      vacant: Number(statsRaw?.vacant ?? statsRaw?.Vacant ?? 0),
    },
    tables: Array.isArray(tablesRaw)
      ? tablesRaw
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map(normalizeTable)
      : [],
  };
}

function normalizeFloor(raw: Record<string, unknown>): CafeFloorPlan {
  const sectionsRaw = raw.sections ?? raw.Sections;
  const unmappedRaw = raw.unmappedActiveOrders ?? raw.UnmappedActiveOrders;
  return {
    sections: Array.isArray(sectionsRaw)
      ? sectionsRaw
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map(normalizeSection)
      : [],
    unmappedActiveOrders: Array.isArray(unmappedRaw)
      ? unmappedRaw
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map(normalizeOrder)
      : [],
    activeOrderCount: Number(raw.activeOrderCount ?? raw.ActiveOrderCount ?? 0),
  };
}

export async function fetchCafeFloorPlan(
  token: string,
  role: "vendor" | "admin"
): Promise<CafeFloorPlan> {
  const path = role === "admin" ? "/api/v1/admin/floor" : "/api/v1/vendor/floor";
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      typeof (err as { error?: string }).error === "string"
        ? (err as { error: string }).error
        : `Could not load floor plan (${res.status})`;
    throw new Error(msg);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeFloor(raw);
}

export { formatCommerceApiError };

export function fulfillmentStatusLabel(code: string): string {
  return code
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
