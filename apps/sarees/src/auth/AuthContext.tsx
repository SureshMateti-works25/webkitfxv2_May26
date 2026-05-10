import { getAtPath } from "@webkitfxv2/core-engine";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type PortalRole = "shopper" | "vendor";

export type AuthState =
  | { status: "anonymous" }
  | { status: "guest" }
  | { status: "signedIn"; role: PortalRole; payload: Record<string, unknown> };

/** Set by your auth API after email login — not collected on the login form. */
export type SignInOptions = { role?: PortalRole };

type AuthContextValue = {
  auth: AuthState;
  /**
   * `payload` is JsonForm values. `options.role` should come from your auth service
   * (role for the verified email). If omitted, `session.role` on the payload is used;
   * otherwise defaults to shopper until the API supplies a role.
   */
  signInMember: (payload: Record<string, unknown>, options?: SignInOptions) => void;
  continueGuest: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "anonymous" });

  const signInMember = useCallback((payload: Record<string, unknown>, options?: SignInOptions) => {
    const fromApi =
      options?.role ??
      getAtPath(payload, "session.role") ??
      getAtPath(payload, "identity.role");
    const role: PortalRole = fromApi === "vendor" ? "vendor" : "shopper";
    setAuth({ status: "signedIn", role, payload });
  }, []);

  const continueGuest = useCallback(() => {
    setAuth({ status: "guest" });
  }, []);

  const signOut = useCallback(() => {
    setAuth({ status: "anonymous" });
  }, []);

  const value = useMemo(
    () => ({ auth, signInMember, continueGuest, signOut }),
    [auth, signInMember, continueGuest, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
