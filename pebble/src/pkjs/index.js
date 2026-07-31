// Phone-side Alloy network proxy and runtime configuration handoff.
const moddableProxy = require("@moddable/pebbleproxy");

const CONFIG_URL = "https://daynest.tjor.im/pebble-pair";

function phoneLocale() {
  try {
    // PKJS exposes navigator on most runtimes but not all; a missing locale is
    // fine, the watch falls back to English.
    return (navigator && navigator.language) || "";
  } catch (error) {
    return "";
  }
}

Pebble.addEventListener("ready", function (event) {
  moddableProxy.readyReceived(event);
});

Pebble.addEventListener("appmessage", function (event) {
  if (moddableProxy.appMessageReceived(event)) return;
});

Pebble.addEventListener("showConfiguration", function () {
  Pebble.openURL(CONFIG_URL);
});

Pebble.addEventListener("webviewclosed", function (event) {
  if (!event.response) return;
  try {
    const result = JSON.parse(decodeURIComponent(event.response));
    if (!result.accessToken) return;
    // Use the proxy's queue rather than Pebble.sendAppMessage directly: PKJS
    // allows only a small number of simultaneously enqueued messages, and the
    // proxy is already using that budget for in-flight fetch() traffic.
    moddableProxy.sendAppMessage(
      {
        API_BASE_URL: "https://daynest.tjor.im",
        AUTH_TOKEN: result.accessToken,
        // The watch has no locale of its own; pass the phone's along so its
        // copy matches the language the rest of Daynest is using.
        LOCALE: phoneLocale()
      },
      function () {
        console.log("Daynest: pairing token relayed to watch");
      },
      function (error) {
        console.log("Daynest: failed to relay pairing token: " + JSON.stringify(error));
      }
    );
  } catch (error) {
    console.log(`Daynest: failed to parse pairing response: ${error}`);
  }
});
