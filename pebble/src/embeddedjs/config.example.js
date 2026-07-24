// Copy this file to config.js (gitignored) and fill in real values before
// building. config.js is loaded by main.js and must export these two names.
//
// API_BASE_URL: the Daynest server's base URL, no trailing slash
//   (e.g. "https://daynest.tjor.im" or "http://10.0.2.2:8000" for a local
//   backend reachable from the phone's network).
// API_INTEGRATION_KEY: an integration client key created from the Daynest
//   web app under Settings > Integration Clients. Sent as X-Integration-Key
//   on every request — see backend/app/api/dependencies/integration_auth.py.
export const API_BASE_URL = "https://daynest.example.invalid";
export const API_INTEGRATION_KEY = "REPLACE_ME";
