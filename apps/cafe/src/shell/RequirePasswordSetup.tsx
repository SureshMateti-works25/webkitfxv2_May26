import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

const ALLOWED = ["/account/set-password", "/login"];

/**
 * Signed-in users with mustChangePassword are sent to set-password before any other route.
 */
export function RequirePasswordSetup({ children }: { children: React.ReactNode }) {
  const { auth, mustChangePassword } = useAuth();
  const { pathname } = useLocation();

  if (auth.status === "signedIn" && mustChangePassword) {
    const allowed = ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!allowed) return <Navigate to="/account/set-password" replace />;
  }

  return <>{children}</>;
}
