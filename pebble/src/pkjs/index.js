// Phone-side Alloy network proxy and runtime configuration handoff.
const moddableProxy = require("@moddable/pebbleproxy");

const CONFIG_URL = "https://daynest.tjor.im/pebble-pair";

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
        AUTH_TOKEN: result.accessToken
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
