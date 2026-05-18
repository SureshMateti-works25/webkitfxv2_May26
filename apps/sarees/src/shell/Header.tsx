import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { getShell } from "../config/getShell.js";
import {
  fetchStorefrontApplicationTypeLabel,
  storefrontApplicationTypeLabelFromConfig,
} from "../lib/getStorefrontApplicationTypeLabel.js";
import { JsonHeader } from "./JsonHeader.js";

export function Header() {
  const shell = getShell();
  const { auth, signOut, continueGuest } = useAuth();
  const [applicationTypeLabel, setApplicationTypeLabel] = useState(() =>
    storefrontApplicationTypeLabelFromConfig()
  );

  useEffect(() => {
    let cancelled = false;
    void fetchStorefrontApplicationTypeLabel().then((label) => {
      if (!cancelled) setApplicationTypeLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <JsonHeader
      shell={shell}
      auth={auth}
      applicationTypeLabel={applicationTypeLabel}
      onSignOut={signOut}
      onContinueGuest={continueGuest}
    />
  );
}
