import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "./app.css";

import * as m from "@/paraglide/messages";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import {
  setDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/app/pwa/installPrompt";
import { appRouter } from "@/app/router/AppRouter";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { fetchOidcConfig } from "@/config/oidc";
import { ThemeProvider } from "@/app/theme/ThemeContext";

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <main className="container py-3 py-md-4">
      <RouterProvider
        router={appRouter}
        context={{
          auth: {
            isAuthenticated,
            isLoading,
          },
        }}
      />
    </main>
  );
}

async function bootstrap() {
  if (import.meta.env.VITE_MSW === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "warn" });
    const { MockAuthProvider } = await import("./mocks/MockAuthProvider");

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <LanguageProvider>
          <MockAuthProvider>
            <QueryProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </QueryProvider>
          </MockAuthProvider>
        </LanguageProvider>
      </React.StrictMode>,
    );
    return;
  }

  let oidcConfig;
  try {
    oidcConfig = await fetchOidcConfig();
  } catch (err) {
    console.error("Failed to fetch OIDC config", err);
    const root = document.getElementById("root");
    if (root) {
      root.textContent = m.app_server_unavailable();
    }
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <OidcProvider {...oidcConfig}>
        <LanguageProvider>
          <AuthProvider>
            <QueryProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </QueryProvider>
          </AuthProvider>
        </LanguageProvider>
      </OidcProvider>
    </React.StrictMode>,
  );
}

bootstrap();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const appVersion = __APP_VERSION__;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    setDeferredInstallPrompt(null);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?appVersion=${encodeURIComponent(appVersion)}`)
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  });
}
