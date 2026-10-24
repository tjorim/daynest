import { useState } from "react";
import * as m from "@/paraglide/messages";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getCustomServerUrl } from "@/lib/api/serverConfig";
import { PwaInstallButton } from "@/features/settings/sections/PwaInstallButton";
import { ServerConfigSection } from "@/features/settings/sections/ServerConfigSection";
import { UserPreferencesSection } from "@/features/settings/sections/UserPreferencesSection";
import { IntegrationClientsSection } from "@/features/settings/sections/IntegrationClientsSection";
import { OAuthSessionsSection } from "@/features/settings/sections/OAuthSessionsSection";
import { AccountDeletionSection } from "@/features/settings/sections/AccountDeletionSection";

export function SettingsPage() {
  useLanguage();
  const [backendBaseUrl, setBackendBaseUrl] = useState(() => {
    const custom = getCustomServerUrl();
    return custom ?? window.location.origin;
  });

  return (
    <section>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <h2 className="text-h4 font-medium mb-0">{m.settings_title()}</h2>
        <PwaInstallButton />
      </div>
      <p className="text-muted-foreground mb-4">{m.settings_subtitle()}</p>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5">
          <ServerConfigSection onBaseUrlChange={setBackendBaseUrl} />
          <UserPreferencesSection />
        </div>
        <div className="col-span-12 lg:col-span-7">
          <IntegrationClientsSection backendBaseUrl={backendBaseUrl} />
          <OAuthSessionsSection />
          <AccountDeletionSection />
        </div>
      </div>
    </section>
  );
}
