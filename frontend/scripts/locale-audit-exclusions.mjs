// Whole files that hold no interface copy: authored data and development fixtures. Keep this list short and
// give each entry a reason; a trailing slash matches a directory.
export const excludedFiles = {
  "mocks/": "MSW development fixtures, loaded only when VITE_MSW is set",
};
// Functions that only log for developers; their string arguments are not interface copy.
export const diagnosticCallees = [];
// Exact source/value exclusions. Never approve a whole component or directory for visible copy.
export const exclusions = {
  "app/layout/AppLayout.tsx": {
    "nav-link active": "CSS class list",
    Daynest: "fixed application brand",
    "btn btn-sm btn-primary": "CSS class list",
    "btn btn-sm btn-outline-primary": "CSS class list",
  },
  "config/oidc.ts": {
    "openid profile email": "OIDC scopes",
  },
  "features/legal/PrivacyPolicyPage.tsx": {
    "tielemans.jorim@gmail.com": "contact address",
  },
  "features/meal-planning/MealSlotModal.tsx": {
    "https://": "URL input example",
  },
  "features/search/SearchOverlay.tsx": {
    "min(640px, 96vw)": "CSS length",
  },
  "features/settings/sections/IntegrationClientsSection.tsx": {
    "GET /api/integrations/home-assistant/summary": "API endpoint path",
    "GET /api/integrations/home-assistant/dashboard": "API endpoint path",
    "POST /api/integrations/home-assistant/actions/complete-task": "API endpoint path",
    "POST /api/integrations/home-assistant/actions/snooze-task": "API endpoint path",
    "POST /api/integrations/home-assistant/actions/mark-medication-taken": "API endpoint path",
    "POST /api/integrations/home-assistant/actions/skip-task": "API endpoint path",
    "POST /api/integrations/home-assistant/actions/skip-medication": "API endpoint path",
    "Home Assistant": "integration product name",
    "home-assistant; version=ha.v1": "API contract identifier",
    "X-Integration-Key": "HTTP header name",
  },
  "lib/api/auth.ts": {
    Bearer: "HTTP authorization scheme",
  },
  "lib/api/http.ts": {
    Bearer: "HTTP authorization scheme",
  },
  "lib/offlineQueue.ts": {
    Bearer: "HTTP authorization scheme",
  },
  "lib/dateUtils.ts": {
    "D/M/YYYY, HH:mm": "Day.js format",
  },
};
