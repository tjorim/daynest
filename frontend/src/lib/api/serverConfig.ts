const STORAGE_KEY = "daynest_custom_server_url";

export function getCustomServerUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCustomServerUrl(url: string | null): void {
  try {
    if (url) {
      localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (e.g., private mode with storage blocked)
  }
}

/** Prepends the stored custom server URL to an API path, if one is configured. */
export function buildApiUrl(path: string): string {
  const base = getCustomServerUrl();
  return base ? `${base}${path}` : path;
}
