#!/usr/bin/env bash
# Generates dev secret files if they don't already exist.
# Run once after a fresh checkout: bash scripts/bootstrap-secrets.sh
set -euo pipefail

SECRETS_DIR="$(cd "$(dirname "$0")/.." && pwd)/secrets/dev"
mkdir -p "$SECRETS_DIR"

if [ ! -f "$SECRETS_DIR/jwt_secret.txt" ]; then
  openssl rand -hex 32 > "$SECRETS_DIR/jwt_secret.txt"
  echo "Created $SECRETS_DIR/jwt_secret.txt"
else
  echo "Skipped jwt_secret.txt (already exists)"
fi

if [ ! -f "$SECRETS_DIR/postgres_password.txt" ]; then
  openssl rand -hex 16 > "$SECRETS_DIR/postgres_password.txt"
  echo "Created $SECRETS_DIR/postgres_password.txt"
else
  echo "Skipped postgres_password.txt (already exists)"
fi

echo "Done. Run 'docker compose up' to start the stack."
