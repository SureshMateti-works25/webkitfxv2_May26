import { useAuth } from "../auth/AuthContext.js";
import { useTenantChrome } from "../lib/useTenantChrome.js";
import { JsonHeader } from "./JsonHeader.js";

export function Header() {
  const { auth, signOut, continueGuest } = useAuth();
  const { shell, displayName, applicationTypeLabel, modeBadge, loading } = useTenantChrome();

  return (
    <JsonHeader
      shell={shell}
      displayName={displayName}
      auth={auth}
      applicationTypeLabel={applicationTypeLabel}
      modeBadge={modeBadge}
      brandingLoading={loading}
      onSignOut={signOut}
      onContinueGuest={continueGuest}
    />
  );
}
