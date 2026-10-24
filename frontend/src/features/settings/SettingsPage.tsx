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
      <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2 tw:mb-2">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.settings_title()}</h2>
        <PwaInstallButton />
      </div>
      <p className="tw:text-muted-foreground tw:mb-4">{m.settings_subtitle()}</p>

      <div className="tw:grid tw:grid-cols-12 tw:gap-4">
        <div className="tw:col-span-12 tw:lg:col-span-5">
          <ServerConfigSection onBaseUrlChange={setBackendBaseUrl} />
          <UserPreferencesSection />
        </div>
        <div className="tw:col-span-12 tw:lg:col-span-7">
          <IntegrationClientsSection backendBaseUrl={backendBaseUrl} />
          <OAuthSessionsSection />
          <AccountDeletionSection />
        </div>
      </div>
    </section>
  );
}
