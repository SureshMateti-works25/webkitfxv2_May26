import { useSyncExternalStore } from "react";

export type QrOrderSession = {
  orderChannel: "qr";
  tableCode: string;
  tableLabel?: string;
  startedAt: string;
};

const SESSION_KEY = "cafe.qrOrder.session.v1";
const SESSION_EVENT = "cafe.qrOrder.session";

let cachedRaw: string | null | undefined;
let cachedSnapshot: QrOrderSession | null = null;

function notifySessionChange(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function invalidateSessionCache(): void {
  cachedRaw = undefined;
  cachedSnapshot = null;
}

function normalizeSession(parsed: QrOrderSession): QrOrderSession | null {
  if (parsed?.orderChannel !== "qr") return null;
  const code = (parsed.tableCode ?? "").trim();
  if (!code) return null;
  return {
    orderChannel: "qr",
    tableCode: code,
    tableLabel: parsed.tableLabel?.trim() || undefined,
    startedAt: parsed.startedAt ?? new Date().toISOString(),
  };
}

export function readQrOrderSession(): QrOrderSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    if (!raw) {
      cachedSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as QrOrderSession;
    cachedSnapshot = normalizeSession(parsed);
    return cachedSnapshot;
  } catch {
    invalidateSessionCache();
    return null;
  }
}

function sessionsEqual(a: QrOrderSession, b: QrOrderSession): boolean {
  return (
    a.tableCode === b.tableCode &&
    (a.tableLabel ?? "") === (b.tableLabel ?? "") &&
    a.startedAt === b.startedAt
  );
}

export function writeQrOrderSession(session: Omit<QrOrderSession, "orderChannel" | "startedAt"> & {
  startedAt?: string;
}): void {
  const next: QrOrderSession = {
    orderChannel: "qr",
    tableCode: session.tableCode.trim(),
    tableLabel: session.tableLabel?.trim() || undefined,
    startedAt: session.startedAt ?? new Date().toISOString(),
  };
  const existing = readQrOrderSession();
  if (existing && sessionsEqual(existing, next)) return;

  const serialized = JSON.stringify(next);
  sessionStorage.setItem(SESSION_KEY, serialized);
  cachedRaw = serialized;
  cachedSnapshot = next;
  notifySessionChange();
}

export function clearQrOrderSession(): void {
  if (!sessionStorage.getItem(SESSION_KEY) && cachedSnapshot == null) return;
  sessionStorage.removeItem(SESSION_KEY);
  invalidateSessionCache();
  notifySessionChange();
}

export function isQrOrderActive(): boolean {
  return readQrOrderSession() != null;
}

export function formatQrTableHeadline(session: QrOrderSession): string {
  const label = (session.tableLabel ?? "").trim();
  if (label) return label;
  const code = session.tableCode;
  return code.match(/^\d+$/) ? `Table ${code}` : code;
}

function subscribeQrOrderSession(onStoreChange: () => void): () => void {
  window.addEventListener(SESSION_EVENT, onStoreChange);
  return () => window.removeEventListener(SESSION_EVENT, onStoreChange);
}

export function useQrOrderSession(): QrOrderSession | null {
  return useSyncExternalStore(subscribeQrOrderSession, readQrOrderSession, readQrOrderSession);
}
