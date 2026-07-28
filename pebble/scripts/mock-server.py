"""Mock of Daynest's Pebble integration routes, for testing the watchapp.

Mirrors backend/app/api/routes/integrations/pebble.py:

    GET  /api/integrations/pebble/dashboard              (pebble:read)
    POST /api/integrations/pebble/actions/complete-task  (pebble:write)
    POST /api/integrations/pebble/actions/skip-task      (pebble:write)

Every request is appended to a log file, which is the point: the acceptance
criteria about repeated button presses and cache replay are claims about what
the server received, not about what the watch displayed. Three rapid SELECT
presses should leave exactly one "POST complete" line behind.

    python3 pebble/scripts/mock-server.py [port] [--host H] [--key K]

Point the watch at it through the pairing flow, or directly:

    pebble send-app-message --emulator emery \
      --string 10000=http://127.0.0.1:8899 10001=test-pebble-key

See ../EMULATOR.md.
"""

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DASHBOARD_PATH = "/api/integrations/pebble/dashboard"
COMPLETE_PATH = "/api/integrations/pebble/actions/complete-task"
SKIP_PATH = "/api/integrations/pebble/actions/skip-task"

STATE = {
    "due_today_count": 3,
    "overdue_count": 2,
    "due_today": [
        {"chore_instance_id": 101, "title": "Water plants", "status": "pending"},
        {"chore_instance_id": 102, "title": "Take out bins", "status": "pending"},
        {"chore_instance_id": 103, "title": "Vacuum hallway", "status": "pending"},
    ],
}


class Handler(BaseHTTPRequestHandler):
    api_key = "test-pebble-key"
    log_path = Path("requests.log")

    def log_message(self, *args):
        """Silence the default stderr access log; we keep our own."""

    def record(self, line):
        with self.log_path.open("a") as fh:
            fh.write(line + "\n")
        print(line, flush=True)

    def authorized(self):
        return self.headers.get("X-Integration-Key") == self.api_key

    def respond(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.authorized():
            self.record(f"GET {self.path} -> 401 (bad or missing key)")
            return self.respond(401, {"detail": "invalid integration key"})
        if self.path != DASHBOARD_PATH:
            self.record(f"GET {self.path} -> 404")
            return self.respond(404, {"detail": "not found"})
        self.record(f"GET {self.path} -> 200 ({STATE['due_today_count']} due)")
        self.respond(200, STATE)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode() if length else ""
        if not self.authorized():
            self.record(f"POST {self.path} {raw} -> 401 (bad or missing key)")
            return self.respond(401, {"detail": "invalid integration key"})

        if self.path == COMPLETE_PATH:
            action = "complete"
        elif self.path == SKIP_PATH:
            action = "skip"
        else:
            self.record(f"POST {self.path} {raw} -> 404")
            return self.respond(404, {"detail": "not found"})

        try:
            chore_instance_id = json.loads(raw).get("chore_instance_id")
        except ValueError:
            self.record(f"POST {action} -> 422 (unparseable body {raw!r})")
            return self.respond(422, {"detail": "invalid body"})

        self.record(f"POST {action} chore_instance_id={chore_instance_id}")
        STATE["due_today"] = [
            item for item in STATE["due_today"] if item["chore_instance_id"] != chore_instance_id
        ]
        STATE["due_today_count"] = len(STATE["due_today"])
        self.respond(200, {"success": True, "detail": f"Task {chore_instance_id} {action}d"})


def main():
    parser = argparse.ArgumentParser(description="Mock Daynest Pebble integration API.")
    parser.add_argument("port", nargs="?", type=int, default=8899)
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="bind address; use 0.0.0.0 to reach it from a watch on the network",
    )
    parser.add_argument("--key", default=Handler.api_key, help="expected X-Integration-Key")
    parser.add_argument("--log", default="requests.log", help="request log file")
    args = parser.parse_args()

    Handler.api_key = args.key
    Handler.log_path = Path(args.log)
    Handler.log_path.write_text("")

    print(f"mock Daynest Pebble API on http://{args.host}:{args.port} (log: {args.log})")
    HTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
