import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { HomeCatalogRails } from "./HomeCatalogRails.js";

const SIGNIN_NOTICES: Record<string, string> = {
  "vendor-submitted":
    "Your vendor account is ready. Add products below — drafts stay private until you mark them active.",
  "shopper-saved": "Your shopper account is ready and you are signed in. Happy browsing.",
  "member-signed-in": "Signed in successfully.",
};

export function HomePage() {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const key = (location.state as { notice?: string } | null)?.notice;
    if (!key) return;
    const msg = SIGNIN_NOTICES[key] ?? key;
    setNotice(msg);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  if (auth.status === "signedIn" && auth.role === "vendor") {
    return <Navigate to="/vendor/products" replace />;
  }

  return (
    <div className="landing-page--fullbleed">
      {notice ? (
        <div className="home-signin-notice" role="status" aria-live="polite">
          <p className="home-signin-notice__text">{notice}</p>
          <button
            type="button"
            className="home-signin-notice__dismiss"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      <HomeCatalogRails />
    </div>
  );
}
