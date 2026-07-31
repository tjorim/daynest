import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import * as m from "@/paraglide/messages";
import { fetchWithAuth } from "@/lib/api/http";

export function PebblePairPage() {
  const { isAuthenticated, isLoading, login, oidcError, sessionError } = useAuth();
  const [closed, setClosed] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [pairAttempt, setPairAttempt] = useState(0);
  const loginRequested = useRef(false);
  const pairRequested = useRef(false);

  useEffect(() => {
    if (
      isLoading ||
      isAuthenticated ||
      oidcError ||
      sessionError ||
      loginRequested.current
    ) {
      return;
    }
    loginRequested.current = true;
    login();
  }, [isAuthenticated, isLoading, login, oidcError, sessionError]);

  useEffect(() => {
    if (!isAuthenticated || closed || pairRequested.current) return;
    pairRequested.current = true;

    const pair = async () => {
      try {
        const response = await fetchWithAuth("/api/integrations/clients/pebble", {
          method: "POST",
        });
        if (!response.ok) throw new Error(`Pairing failed (${response.status})`);
        const result = (await response.json()) as { api_key?: string };
        if (!result.api_key) throw new Error("Pairing response did not include a token");
        const payload = encodeURIComponent(JSON.stringify({ accessToken: result.api_key }));
        window.location.href = `pebblejs://close#${payload}`;
        setClosed(true);
      } catch (error) {
        pairRequested.current = false;
        setPairingError(error instanceof Error ? error.message : String(error));
      }
    };
    void pair();
  }, [closed, isAuthenticated, pairAttempt]);

  const retryPairing = () => {
    setPairingError("");
    setPairAttempt((attempt) => attempt + 1);
  };

  // A sign-in failure leaves loginRequested latched, so the auto-login effect
  // will never fire again on its own. Without this the page is a dead end:
  // an error message, a watch still unpaired, and nothing to click.
  const retrySignIn = () => {
    loginRequested.current = true;
    login();
  };

  const signInFailed = Boolean(oidcError || sessionError);

  return (
    <section className="mx-auto py-5 text-center" style={{ maxWidth: "32rem" }}>
      <h1 className="h4 mb-3">{m.pebble_pair_title()}</h1>
      <p className="text-body-secondary mb-4">{m.pebble_pair_description()}</p>

      {signInFailed || pairingError ? (
        <div className="alert alert-danger" role="alert">
          <div>{pairingError || oidcError || sessionError}</div>
          <button
            className="btn btn-sm btn-outline-danger mt-3"
            type="button"
            onClick={pairingError ? retryPairing : retrySignIn}
          >
            {pairingError ? m.pebble_pair_retry() : m.pebble_pair_retry_sign_in()}
          </button>
        </div>
      ) : closed ? (
        <div className="alert alert-success" role="status">
          {m.pebble_pair_close_instruction()}
        </div>
      ) : (
        <div
          className="d-flex align-items-center justify-content-center gap-2 text-body-secondary"
          role="status"
        >
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          {m.pebble_pair_connecting()}
        </div>
      )}
    </section>
  );
}
