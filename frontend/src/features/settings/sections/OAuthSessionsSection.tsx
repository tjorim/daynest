import { useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import { listOAuthSessions, revokeOAuthSession, type OAuthSession } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { formatDateTime } from "@/lib/dateUtils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";
import { Badge } from "@/components/ui/badge";

export function OAuthSessionsSection() {
  const [oauthSessions, setOauthSessions] = useState<OAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadSessions = async (signal?: AbortSignal) => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const sessions = await listOAuthSessions();
      if (!signal?.aborted) {
        setOauthSessions(sessions);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setSessionsError(apiErrorMessage(err, m.load_oauth_sessions_failed()));
      }
    } finally {
      if (!signal?.aborted) {
        setSessionsLoading(false);
      }
    }
  };

  const onRevokeSession = async (session: OAuthSession) => {
    if (session.is_current && !window.confirm(m.settings_revoke_current_session_confirm())) {
      return;
    }

    const sessionId = session.id;
    setRevokingSession(sessionId);
    setRevokeError(null);
    try {
      await revokeOAuthSession(sessionId);
      await loadSessions();
    } catch (err) {
      setRevokeError(apiErrorMessage(err, m.revoke_session_failed()));
    } finally {
      setRevokingSession(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadSessions(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <Card className="tw:mt-4">
      <CardHeader className="tw:flex tw:justify-between tw:items-center tw:py-2">
        <span className="tw:font-semibold">{m.settings_oauth_sessions_header()}</span>
        <Button
          variant="outline-secondary"
          size="sm"
          disabled={sessionsLoading}
          onClick={() => void loadSessions()}
        >
          {m.settings_refresh()}
        </Button>
      </CardHeader>
      {sessionsLoading ? (
        <CardContent className="tw:py-2 tw:text-muted-foreground tw:text-small">
          {m.settings_loading_sessions()}
        </CardContent>
      ) : sessionsError ? (
        <CardContent className="tw:py-2 tw:text-danger tw:text-small">{sessionsError}</CardContent>
      ) : (
        <ListGroup flush render={<ul />}>
          {oauthSessions.length === 0 ? (
            <ListGroupItem render={<li />} className="tw:py-2 tw:text-muted-foreground">
              {m.settings_no_sessions()}
            </ListGroupItem>
          ) : (
            oauthSessions.map((session) => {
              const clientNames = session.clients.map((c) => c.clientName ?? c.clientId);
              const lastAccess = session.last_access ? formatDateTime(session.last_access) : null;
              const metaParts = [
                session.ip_address ? m.settings_ip_address({ ip: session.ip_address }) : null,
                lastAccess ? m.settings_last_active({ date: lastAccess }) : null,
              ].filter(Boolean);
              return (
                <ListGroupItem render={<li />} className="tw:py-2" key={session.id}>
                  <div className="tw:flex tw:justify-between tw:items-start tw:gap-4">
                    <div>
                      <div className="tw:font-semibold tw:flex tw:items-center tw:flex-wrap tw:gap-2">
                        <span>
                          {clientNames.length > 0
                            ? clientNames.join(", ")
                            : m.settings_unknown_client()}
                        </span>
                        {session.is_current ? (
                          <Badge variant="primary">{m.settings_this_device()}</Badge>
                        ) : null}
                      </div>
                      {metaParts.length > 0 ? (
                        <small className="tw:text-muted-foreground tw:block">
                          {metaParts.join(" • ")}
                        </small>
                      ) : null}
                    </div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="tw:shrink-0"
                      disabled={revokingSession === session.id}
                      onClick={() => void onRevokeSession(session)}
                    >
                      {revokingSession === session.id ? m.settings_revoking() : m.settings_revoke()}
                    </Button>
                  </div>
                </ListGroupItem>
              );
            })
          )}
        </ListGroup>
      )}
      {revokeError ? (
        <CardFooter className="tw:text-danger tw:py-2 tw:text-small">{revokeError}</CardFooter>
      ) : null}
    </Card>
  );
}
