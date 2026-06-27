import { useState } from "react";
import * as m from "@/paraglide/messages";
import { getCustomServerUrl, setCustomServerUrl } from "@/lib/api/serverConfig";

type ServerMode = "default" | "custom";

export function ServerConfigSection({ onBaseUrlChange }: { onBaseUrlChange: (url: string) => void }) {
  const [serverMode, setServerMode] = useState<ServerMode>(() =>
    getCustomServerUrl() ? "custom" : "default",
  );
  const [customServerInput, setCustomServerInput] = useState(() => getCustomServerUrl() ?? "");
  const [serverUrlError, setServerUrlError] = useState<string | null>(null);

  const applyServerUrl = () => {
    if (serverMode === "default") {
      setCustomServerUrl(null);
      onBaseUrlChange(window.location.origin);
      setServerUrlError(null);
      return;
    }
    const trimmed = customServerInput.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setServerUrlError("Enter a valid absolute URL.");
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setServerUrlError("URL must use https:// or http://.");
      return;
    }
    setCustomServerUrl(parsed.origin);
    onBaseUrlChange(parsed.origin);
    setServerUrlError(null);
  };

  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold py-2">{m.settings_backend_server_header()}</div>
      <div className="card-body d-grid gap-2">
        <div className="d-flex gap-3">
          <label className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="server-mode"
              checked={serverMode === "default"}
              onChange={() => {
                setServerMode("default");
                setServerUrlError(null);
              }}
            />
            <span className="form-check-label">{m.settings_default()}</span>
          </label>
          <label className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="server-mode"
              checked={serverMode === "custom"}
              onChange={() => setServerMode("custom")}
            />
            <span className="form-check-label">{m.settings_custom_self_hosted()}</span>
          </label>
        </div>
        {serverMode === "custom" ? (
          <div>
            <input
              className={`form-control${serverUrlError ? " is-invalid" : ""}`}
              value={customServerInput}
              onChange={(event) => {
                setCustomServerInput(event.target.value);
                setServerUrlError(null);
              }}
              placeholder={m.settings_custom_placeholder()}
              aria-label={m.settings_custom_placeholder()}
            />
            {serverUrlError ? (
              <div className="invalid-feedback">{serverUrlError}</div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={applyServerUrl}
        >
          {m.settings_apply()}
        </button>
      </div>
    </div>
  );
}
