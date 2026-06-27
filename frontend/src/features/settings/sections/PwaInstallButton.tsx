import { useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import {
  getDeferredInstallPrompt,
  promptToInstallApp,
  subscribeInstallPrompt,
} from "@/app/pwa/installPrompt";

export function PwaInstallButton() {
  const [isInstalling, setIsInstalling] = useState(false);
  const [canInstallApp, setCanInstallApp] = useState(() => Boolean(getDeferredInstallPrompt()));

  useEffect(() => subscribeInstallPrompt(() => setCanInstallApp(Boolean(getDeferredInstallPrompt()))), []);

  if (!canInstallApp) {
    return null;
  }

  const onInstallApp = async () => {
    setIsInstalling(true);
    try {
      await promptToInstallApp();
    } catch (error) {
      console.error("PWA install prompt failed:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      disabled={isInstalling}
      onClick={() => void onInstallApp()}
    >
      {m.settings_install_app()}
    </button>
  );
}
