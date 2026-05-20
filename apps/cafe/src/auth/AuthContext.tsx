import { getAtPath } from "@webkitfxv2/core-engine";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAuthMe } from "../lib/commerceApi.js";
import { getCommerceTenantId } from "../dev/devTenantStore.js";

export type PortalRole = "shopper" | "vendor" | "admin";

function authStorageKey(tenantId: string = getCommerceTenantId()): string {
  return `webkitfx.auth.${tenantId}`;
}

export type AuthState =
  | { status: "anonymous" }
  | { status: "guest" }
  | { status: "signedIn"; role: PortalRole; accessToken: string; payload: Record<string, unknown> };

export type SignInOptions = {
  role?: PortalRole;
  accessToken?: string;
  mustChangePassword?: boolean;
};

type AuthContextValue = {
  auth: AuthState;
  tenantId: string;
  mustChangePassword: boolean;
  signInMember: (payload: Record<string, unknown>, options?: SignInOptions) => void;
  continueGuest: () => void;
  signOut: () => void;
  clearMustChangePassword: () => void;
  getAccessToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(tenantId: string): AuthState {
  try {
    const key = authStorageKey(tenantId);
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return { status: "anonymous" };
    const s = JSON.parse(raw) as {
      accessToken?: string;
      role?: PortalRole;
      payload?: Record<string, unknown>;
    };
    if (s.accessToken && s.role && s.payload) {
      return { status: "signedIn", role: s.role, accessToken: s.accessToken, payload: s.payload };
    }
  } catch {
    localStorage.removeItem(authStorageKey(tenantId));
    sessionStorage.removeItem(authStorageKey(tenantId));
  }
  return { status: "anonymous" };
}

function readMustChangePassword(payload: Record<string, unknown>): boolean {
  return getAtPath(payload, "session.mustChangePassword") === true;
}

function persistAuth(
  role: PortalRole,
  accessToken: string,
  payload: Record<string, unknown>,
  remember: boolean
): void {
  const tid = getCommerceTenantId();
  const key = authStorageKey(tid);
  const packed = JSON.stringify({ accessToken, role, payload });
  sessionStorage.setItem(key, packed);
  if (remember) localStorage.setItem(key, packed);
  else localStorage.removeItem(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tenantId = getCommerceTenantId();
  const [auth, setAuth] = useState<AuthState>(() => readStoredAuth(tenantId));
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    const a = readStoredAuth(tenantId);
    return a.status === "signedIn" ? readMustChangePassword(a.payload) : false;
  });

  useEffect(() => {
    const next = readStoredAuth(tenantId);
    setAuth(next);
    setMustChangePassword(next.status === "signedIn" ? readMustChangePassword(next.payload) : false);
  }, [tenantId]);

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    let cancelled = false;
    void fetchAuthMe(auth.accessToken)
      .then((me) => {
        if (cancelled) return;
        setMustChangePassword(me.mustChangePassword);
        setAuth((prev) => {
          if (prev.status !== "signedIn") return prev;
          const session = {
            ...(typeof getAtPath(prev.payload, "session") === "object"
              ? (getAtPath(prev.payload, "session") as Record<string, unknown>)
              : {}),
            email: me.email,
            role: me.role,
            permissionRole: me.permissionRole,
            userId: me.userId,
            tenantId: me.tenantId,
            storefrontMode: me.storefrontMode,
            mustChangePassword: me.mustChangePassword,
          };
          const credentials = {
            ...(typeof getAtPath(prev.payload, "credentials") === "object"
              ? (getAtPath(prev.payload, "credentials") as Record<string, unknown>)
              : {}),
            loginName: me.email,
          };
          const profile =
            me.profile != null
              ? { profile: me.profile }
              : typeof getAtPath(prev.payload, "profile") === "object"
                ? { profile: getAtPath(prev.payload, "profile") }
                : {};
          const nextRole: PortalRole =
            me.role === "vendor" || me.role === "admin" ? me.role : "shopper";
          const nextPayload = { ...prev.payload, session, credentials, ...profile };
          const remember = getAtPath(prev.payload, "session.rememberMe") === true;
          persistAuth(nextRole, prev.accessToken, nextPayload, remember);
          return {
            ...prev,
            role: nextRole,
            payload: nextPayload,
          };
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("Token tenant does not match request tenant")) return;
        const key = authStorageKey(getCommerceTenantId());
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        setAuth({ status: "anonymous" });
        setMustChangePassword(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status === "signedIn" ? auth.accessToken : "", tenantId]);

  const signInMember = useCallback((payload: Record<string, unknown>, options?: SignInOptions) => {
    const fromApi =
      options?.role ??
      (getAtPath(payload, "session.role") as PortalRole | undefined) ??
      (getAtPath(payload, "identity.role") as PortalRole | undefined);
    const role: PortalRole =
      fromApi === "vendor" || fromApi === "admin" ? fromApi : "shopper";
    const accessToken =
      options?.accessToken ?? (getAtPath(payload, "session.accessToken") as string | undefined) ?? "";
    const mustChange = options?.mustChangePassword === true;
    const session = {
      ...(typeof getAtPath(payload, "session") === "object"
        ? (getAtPath(payload, "session") as Record<string, unknown>)
        : {}),
      mustChangePassword: mustChange,
    };
    const nextPayload = { ...payload, session };
    setAuth({ status: "signedIn", role, accessToken, payload: nextPayload });
    setMustChangePassword(mustChange);

    const remember = getAtPath(payload, "session.rememberMe") === true;
    if (accessToken) persistAuth(role, accessToken, nextPayload, remember);
  }, []);

  const continueGuest = useCallback(() => {
    setAuth({ status: "guest" });
    setMustChangePassword(false);
  }, []);

  const signOut = useCallback(() => {
    const key = authStorageKey(getCommerceTenantId());
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    setAuth({ status: "anonymous" });
    setMustChangePassword(false);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
    setAuth((prev) => {
      if (prev.status !== "signedIn") return prev;
      const session = {
        ...(typeof getAtPath(prev.payload, "session") === "object"
          ? (getAtPath(prev.payload, "session") as Record<string, unknown>)
          : {}),
        mustChangePassword: false,
      };
      const nextPayload = { ...prev.payload, session };
      const remember = getAtPath(prev.payload, "session.rememberMe") === true;
      persistAuth(prev.role, prev.accessToken, nextPayload, remember);
      return { ...prev, payload: nextPayload };
    });
  }, []);

  const getAccessToken = useCallback(() => {
    return auth.status === "signedIn" ? auth.accessToken : null;
  }, [auth]);

  const value = useMemo(
    () => ({
      auth,
      tenantId,
      mustChangePassword,
      signInMember,
      continueGuest,
      signOut,
      clearMustChangePassword,
      getAccessToken,
    }),
    [
      auth,
      tenantId,
      mustChangePassword,
      signInMember,
      continueGuest,
      signOut,
      clearMustChangePassword,
      getAccessToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
