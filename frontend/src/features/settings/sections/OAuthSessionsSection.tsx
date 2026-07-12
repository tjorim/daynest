import { useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import {
  listOAuthSessions,
  revokeOAuthSession,
  type OAuthSession,
} from "@/lib/api/auth";

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
        setSessionsError(err instanceof Error ? err.message : "Unable to load OAuth sessions.");
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
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke session.");
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
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <span className="fw-semibold">{m.settings_oauth_sessions_header()}</span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={sessionsLoading}
          onClick={() => void loadSessions()}
        >
          {m.settings_refresh()}
        </button>
      </div>
      {sessionsLoading ? (
        <div className="card-body py-2 text-muted small">{m.settings_loading_sessions()}</div>
      ) : sessionsError ? (
        <div className="card-body py-2 text-danger small">{sessionsError}</div>
      ) : (
        <ul className="list-group list-group-flush">
          {oauthSessions.length === 0 ? (
            <li className="list-group-item py-2 text-muted">{m.settings_no_sessions()}</li>
          ) : (
            oauthSessions.map((session) => {
              const clientNames = session.clients.map((c) => c.clientName ?? c.clientId);
              const lastAccess = session.last_access
                ? new Date(session.last_access).toLocaleString()
                : null;
              const metaParts = [
                session.ip_address ? m.settings_ip_address({ ip: session.ip_address }) : null,
                lastAccess ? m.settings_last_active({ date: lastAccess }) : null,
              ].filter(Boolean);
              return (
                <li key={session.id} className="list-group-item py-2">
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div>
                      <div className="fw-semibold d-flex align-items-center flex-wrap gap-2">
                        <span>
                          {clientNames.length > 0 ? clientNames.join(", ") : m.settings_unknown_client()}
                        </span>
                        {session.is_current ? (
                          <span className="badge text-bg-primary">{m.settings_this_device()}</span>
                        ) : null}
                      </div>
                      {metaParts.length > 0 ? (
                        <small className="text-muted d-block">{metaParts.join(" • ")}</small>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm flex-shrink-0"
                      disabled={revokingSession === session.id}
                      onClick={() => void onRevokeSession(session)}
                    >
                      {revokingSession === session.id ? m.settings_revoking() : m.settings_revoke()}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
      {revokeError ? <div className="card-footer text-danger py-2 small">{revokeError}</div> : null}
    </div>
  );
}
