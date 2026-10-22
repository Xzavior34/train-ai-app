import React from "react";
import { ShieldAlert } from "lucide-react";
import { isTemporaryAccessError } from "../../lib/workspaceAccess.js";
import "./AccessRecoveryScreen.css";

export default function AccessRecoveryScreen({ error, security = false, onRetry, onSignOut }) {
  const networkError = isTemporaryAccessError({ message: error });
  return (
    <main className="access-recovery">
      <section className="access-recovery-card" role="alert" aria-labelledby="access-recovery-title">
        <ShieldAlert size={32} aria-hidden="true" />
        <h1 id="access-recovery-title">{networkError ? "We couldn’t connect to your workspace" : security ? "We couldn’t verify account security" : "We couldn’t verify workspace access"}</h1>
        <p>{networkError
          ? "Check your internet connection and try again. If you’re connected, the service may be temporarily unavailable."
          : "Please try again to securely verify your account. You can also sign out and sign in again."}</p>
        <div className="access-recovery-actions">
          <button type="button" onClick={onRetry}>Try again</button>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </section>
    </main>
  );
}
