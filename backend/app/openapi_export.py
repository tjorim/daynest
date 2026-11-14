"""The OpenAPI document the frontend API types are checked against.

``frontend/openapi.json`` is a committed snapshot of this document. Run ``uv run python -m app.openapi_export``
from ``backend/`` to rewrite it after changing a route or a schema, or add ``--check`` to fail when it is stale
(``tests/test_openapi_snapshot.py`` does the same). Nothing here reads a database or a secret.
"""

import json
import sys
from pathlib import Path

from app.main import app

SNAPSHOT = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def document() -> str:
    """The schema as stable JSON text. The release version is left out so a release bump never stales it."""
    schema = app.openapi()
    stable = {**schema, "info": {**schema["info"], "version": "snapshot"}}
    return json.dumps(stable, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    current = document()
    if "--check" in argv:
        if not SNAPSHOT.exists() or SNAPSHOT.read_text(encoding="utf-8") != current:
            print(f"{SNAPSHOT} is stale: run `uv run python -m app.openapi_export` in backend/.", file=sys.stderr)
            return 1
        return 0
    SNAPSHOT.write_text(current, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
