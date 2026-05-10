import { getAtPath } from "@webkitfxv2/core-engine";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type PortalRole = "shopper" | "vendor";

const AUTH_STORAGE = "webkitfx.auth";

export type AuthState =
  | { status: "anonymous" }
  | { status: "guest" }
  | { status: "signedIn"; role: PortalRole; accessToken: string; payload: Record<string, unknown> };

export type SignInOptions = { role?: PortalRole; accessToken?: string };

type AuthContextValue = {
  auth: AuthState;
  /**
   * `payload` is JsonForm values. Pass `accessToken` from Catalog.Api login/register.
   * `options.role` overrides role claim when the API returns a different shape.
   */
  signInMember: (payload: Record<string, unknown>, options?: SignInOptions) => void;
  continueGuest: () => void;
  signOut: () => void;
  /** Bearer token when signed in; use for `Authorization` on API calls. */
  getAccessToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "anonymous" });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        accessToken?: string;
        role?: PortalRole;
        payload?: Record<string, unknown>;
      };
      if (s.accessToken && s.role && s.payload)
        setAuth({ status: "signedIn", role: s.role, accessToken: s.accessToken, payload: s.payload });
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE);
    }
  }, []);

  const signInMember = useCallback((payload: Record<string, unknown>, options?: SignInOptions) => {
    const fromApi =
      options?.role ??
      (getAtPath(payload, "session.role") as PortalRole | undefined) ??
      (getAtPath(payload, "identity.role") as PortalRole | undefined);
    const role: PortalRole = fromApi === "vendor" ? "vendor" : "shopper";
    const accessToken =
      options?.accessToken ?? (getAtPath(payload, "session.accessToken") as string | undefined) ?? "";
    setAuth({ status: "signedIn", role, accessToken, payload });

    const remember = getAtPath(payload, "session.rememberMe") === true;
    if (remember && accessToken)
      sessionStorage.setItem(AUTH_STORAGE, JSON.stringify({ accessToken, role, payload }));
  }, []);

  const continueGuest = useCallback(() => {
    setAuth({ status: "guest" });
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE);
    setAuth({ status: "anonymous" });
  }, []);

  const getAccessToken = useCallback(() => {
    return auth.status === "signedIn" ? auth.accessToken : null;
  }, [auth]);

  const value = useMemo(
    () => ({ auth, signInMember, continueGuest, signOut, getAccessToken }),
    [auth, signInMember, continueGuest, signOut, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
