import { useState } from "react";
import * as m from "@/paraglide/messages";
import { getCustomServerUrl, setCustomServerUrl } from "@/lib/api/serverConfig";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Radio } from "@/components/ui/radio";

type ServerMode = "default" | "custom";

export function ServerConfigSection({
  onBaseUrlChange,
}: {
  onBaseUrlChange: (url: string) => void;
}) {
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
      setServerUrlError(m.settings_server_url_invalid());
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setServerUrlError(m.settings_server_url_protocol());
      return;
    }
    setCustomServerUrl(parsed.origin);
    onBaseUrlChange(parsed.origin);
    setServerUrlError(null);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="font-semibold py-2">{m.settings_backend_server_header()}</CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex gap-4">
          <label className="check-row mb-0.5">
            <Radio
              name="server-mode"
              checked={serverMode === "default"}
              onChange={() => {
                setServerMode("default");
                setServerUrlError(null);
              }}
            />
            <span>{m.settings_default()}</span>
          </label>
          <label className="check-row mb-0.5">
            <Radio
              name="server-mode"
              checked={serverMode === "custom"}
              onChange={() => setServerMode("custom")}
            />
            <span>{m.settings_custom_self_hosted()}</span>
          </label>
        </div>
        {serverMode === "custom" ? (
          <div>
            <Input
              aria-invalid={serverUrlError ? true : undefined}
              value={customServerInput}
              onChange={(event) => {
                setCustomServerInput(event.target.value);
                setServerUrlError(null);
              }}
              placeholder={m.settings_custom_placeholder()}
              aria-label={m.settings_custom_placeholder()}
            />
            {serverUrlError ? <FieldError>{serverUrlError}</FieldError> : null}
          </div>
        ) : null}
        <Button variant="outline-primary" size="sm" onClick={applyServerUrl}>
          {m.settings_apply()}
        </Button>
      </CardContent>
    </Card>
  );
}
