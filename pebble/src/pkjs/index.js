// Enables fetch()/HTTPClient/WebSocket calls made from the watch (src/embeddedjs)
// to reach the internet by proxying them through PebbleKit JS on the phone.
// See: https://developer.repebble.com/guides/alloy/networking/
const moddableProxy = require("@moddable/pebbleproxy");

Pebble.addEventListener("ready", moddableProxy.readyReceived);

Pebble.addEventListener("appmessage", function (e) {
  if (moddableProxy.appMessageReceived(e)) return;

  // Not a Moddable proxy event — nothing else to handle for this app.
});
