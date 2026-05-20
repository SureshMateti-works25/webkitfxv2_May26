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

export type SignInOptions = { role?: PortalRole; accessToken?: string };

type AuthContextValue = {
  auth: AuthState;
  tenantId: string;
  /**
   * `payload` is JsonForm values. Pass `accessToken` from Commerce.Api login/register.
   * `options.role` overrides role claim when the API returns a different shape.
   */
  signInMember: (payload: Record<string, unknown>, options?: SignInOptions) => void;
  continueGuest: () => void;
  signOut: () => void;
  /** Bearer token when signed in; use for `Authorization` on API calls. */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const tenantId = getCommerceTenantId();
  const [auth, setAuth] = useState<AuthState>(() => readStoredAuth(tenantId));

  useEffect(() => {
    setAuth(readStoredAuth(tenantId));
  }, [tenantId]);

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    let cancelled = false;
    void fetchAuthMe(auth.accessToken)
      .then((me) => {
        if (cancelled) return;
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
          };
          const credentials = {
            ...(typeof getAtPath(prev.payload, "credentials") === "object"
              ? (getAtPath(prev.payload, "credentials") as Record<string, unknown>)
              : {}),
            loginName: me.email,
          };
          return {
            ...prev,
            role: me.role === "vendor" || me.role === "admin" ? me.role : "shopper",
            payload: { ...prev.payload, session, credentials },
          };
        });
      })
      .catch(() => {
        /* token invalid for this tenant */
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status === "signedIn" ? auth.accessToken : "", tenantId]);

  const signInMember = useCallback(
    (payload: Record<string, unknown>, options?: SignInOptions) => {
      const fromApi =
        options?.role ??
        (getAtPath(payload, "session.role") as PortalRole | undefined) ??
        (getAtPath(payload, "identity.role") as PortalRole | undefined);
      const role: PortalRole =
        fromApi === "vendor" || fromApi === "admin" ? fromApi : "shopper";
      const accessToken =
        options?.accessToken ?? (getAtPath(payload, "session.accessToken") as string | undefined) ?? "";
      setAuth({ status: "signedIn", role, accessToken, payload });

      const remember = getAtPath(payload, "session.rememberMe") === true;
      const tid = getCommerceTenantId();
      const key = authStorageKey(tid);
      if (accessToken) {
        const packed = JSON.stringify({ accessToken, role, payload });
        sessionStorage.setItem(key, packed);
        if (remember) localStorage.setItem(key, packed);
        else localStorage.removeItem(key);
      }
    },
    []
  );

  const continueGuest = useCallback(() => {
    setAuth({ status: "guest" });
  }, []);

  const signOut = useCallback(() => {
    const key = authStorageKey(getCommerceTenantId());
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    setAuth({ status: "anonymous" });
  }, []);

  const getAccessToken = useCallback(() => {
    return auth.status === "signedIn" ? auth.accessToken : null;
  }, [auth]);

  const value = useMemo(
    () => ({ auth, tenantId, signInMember, continueGuest, signOut, getAccessToken }),
    [auth, tenantId, signInMember, continueGuest, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
