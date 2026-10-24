import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import * as m from "@/paraglide/messages";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, fetchWithAuth, readErrorBody } from "@/lib/api/http";

export function PebblePairPage() {
  const { isAuthenticated, isLoading, login, oidcError, sessionError } = useAuth();
  const [closed, setClosed] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [pairAttempt, setPairAttempt] = useState(0);
  const loginRequested = useRef(false);
  const pairRequested = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || oidcError || sessionError || loginRequested.current) {
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
        if (!response.ok) {
          const { message, code, params } = await readErrorBody(
            response,
            m.pebble_pairing_failed(),
          );
          throw new ApiError(message, response.status, false, null, code, params);
        }
        const result = (await response.json()) as { api_key?: string };
        if (!result.api_key) throw new Error("Pairing response did not include a token");
        const payload = encodeURIComponent(JSON.stringify({ accessToken: result.api_key }));
        window.location.href = `pebblejs://close#${payload}`;
        setClosed(true);
      } catch (error) {
        pairRequested.current = false;
        setPairingError(apiErrorMessage(error, m.pebble_pairing_failed()));
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
    <section className="tw:mx-auto tw:max-w-lg tw:py-12 tw:text-center">
      <h1 className="tw:mb-4 tw:text-h4 tw:font-medium">{m.pebble_pair_title()}</h1>
      <p className="tw:mb-6 tw:text-muted-foreground">{m.pebble_pair_description()}</p>

      {signInFailed || pairingError ? (
        <Alert variant="danger" role="alert">
          <div>{pairingError || oidcError || sessionError}</div>
          <Button
            variant="outline-danger"
            size="sm"
            className="tw:mt-4"
            onClick={pairingError ? retryPairing : retrySignIn}
          >
            {pairingError ? m.pebble_pair_retry() : m.pebble_pair_retry_sign_in()}
          </Button>
        </Alert>
      ) : closed ? (
        <Alert variant="success" role="status">
          {m.pebble_pair_close_instruction()}
        </Alert>
      ) : (
        <div
          className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-muted-foreground"
          role="status"
        >
          <Spinner />
          {m.pebble_pair_connecting()}
        </div>
      )}
    </section>
  );
}
