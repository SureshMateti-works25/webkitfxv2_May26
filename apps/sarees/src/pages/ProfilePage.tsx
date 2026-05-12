import { getAtPath } from "@webkitfxv2/core-engine";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { getShell } from "../config/getShell.js";

function asStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function ProfilePage() {
  const { auth } = useAuth();
  const shell = getShell();
  const copy = shell.screens.accountProfile;

  if (auth.status !== "signedIn") {
    return <Navigate to="/login" replace />;
  }

  const { role, payload } = auth;
  const sessionEmail = asStr(getAtPath(payload, "session.email"));
  const userId = asStr(getAtPath(payload, "session.userId"));
  const loginName = asStr(getAtPath(payload, "credentials.loginName"));

  const roleLabel = role === "vendor" ? "Vendor" : role === "admin" ? "Site admin" : "Shopper";

  const rows: { label: string; value: string }[] = [
    { label: "Role", value: roleLabel },
    { label: "Signed in as", value: sessionEmail || loginName || "—" },
    { label: "User ID", value: userId || "—" },
  ];

  if (role === "shopper") {
    const fullName = asStr(getAtPath(payload, "profile.fullName"));
    const profileEmail = asStr(getAtPath(payload, "profile.email"));
    const phone = asStr(getAtPath(payload, "profile.phone"));
    if (fullName) rows.push({ label: "Full name", value: fullName });
    if (profileEmail && profileEmail !== sessionEmail)
      rows.push({ label: "Profile email", value: profileEmail });
    if (phone) rows.push({ label: "Mobile", value: phone });
    const line1 = asStr(getAtPath(payload, "profile.address.line1"));
    if (line1) {
      const city = asStr(getAtPath(payload, "profile.address.city"));
      const state = asStr(getAtPath(payload, "profile.address.state"));
      const pin = asStr(getAtPath(payload, "profile.address.pinCode"));
      rows.push({
        label: "Delivery address",
        value: [line1, city, state, pin].filter(Boolean).join(", "),
      });
    }
  } else if (role === "vendor") {
    const businessName = asStr(getAtPath(payload, "vendor.registration.businessName"));
    const outlet = asStr(getAtPath(payload, "vendor.registration.outletCode"));
    const gstin = asStr(getAtPath(payload, "vendor.registration.gstin"));
    if (businessName) rows.push({ label: "Business name", value: businessName });
    if (outlet) rows.push({ label: "Outlet code", value: outlet });
    if (gstin) rows.push({ label: "GSTIN", value: gstin });
  }

  return (
    <div className="screen-prose profile-page">
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <dl className="profile-summary">
        {rows.map((r) => (
          <div key={r.label} className="profile-summary__row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
