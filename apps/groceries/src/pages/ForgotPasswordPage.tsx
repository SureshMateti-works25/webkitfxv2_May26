import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword, formatCommerceApiError } from "../lib/commerceApi.js";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="screen-prose">
      <h1>Forgot password</h1>
      <p>Enter your account email and set a new password to regain access.</p>
      <form
        className="login-card__form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSuccess(null);
          if (!email.trim()) {
            setError("Email is required.");
            return;
          }
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
            await forgotPassword(email.trim(), nextPassword);
            setSuccess("Password reset complete. Use your new password to sign in.");
            window.setTimeout(() => navigate("/login"), 1000);
          } catch (err) {
            setError(formatCommerceApiError(err));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {submitting ? "Resetting..." : "Reset password"}
          </button>
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
