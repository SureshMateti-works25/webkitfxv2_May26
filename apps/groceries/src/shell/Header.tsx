import { useAuth } from "../auth/AuthContext.js";
import { getShell } from "../config/getShell.js";
import { JsonHeader } from "./JsonHeader.js";

export function Header() {
  const shell = getShell();
  const { auth, signOut, continueGuest } = useAuth();
  return <JsonHeader shell={shell} auth={auth} onSignOut={signOut} onContinueGuest={continueGuest} />;
}
