import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { changePassword, formatCommerceApiError } from "../lib/commerceApi.js";

export function ChangePasswordPage() {
  const { auth } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (auth.status !== "signedIn") return <Navigate to="/login" replace />;

  return (
    <div className="screen-prose">
      <h1>Change password</h1>
      <p>Update your account password. Use at least 8 characters.</p>
      <form
        className="login-card__form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSuccess(null);
          if (nextPassword.length < 8) {
            setError("New password must be at least 8 characters.");
            return;
          }
          if (nextPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
          }
          setSubmitting(true);
          try {
            await changePassword(auth.accessToken, currentPassword, nextPassword);
            setSuccess("Password updated successfully.");
            setCurrentPassword("");
            setNextPassword("");
            setConfirmPassword("");
          } catch (err) {
            setError(formatCommerceApiError(err));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error ? (
          <p role="alert" className="login-card__error">
            {error}
          </p>
        ) : null}
        {success ? <p role="status">{success}</p> : null}
        <div className="webkitfx-form-actions">
          <button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Updating..." : "Update password"}
          </button>
          <Link to="/account/profile">Back to profile</Link>
        </div>
      </form>
    </div>
  );
}
