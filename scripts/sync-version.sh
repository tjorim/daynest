#!/usr/bin/env bash
# Stamps the root VERSION file's value into every app file that has to carry
# a static, checked-in copy (npm requires a literal in package.json; HACS
# reads manifest.json straight from the repo with no build step). VERSION
# stays the single source of truth — run this after bumping it.
#
# Does NOT touch python-daynest/pyproject.toml or manifest.json's
# python-daynest requirements pin: the library keeps its own independent
# SemVer version, decoupled from the app's CalVer version (see issue #673).
#
# Usage: bash scripts/sync-version.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(<"$ROOT_DIR/VERSION")"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error::VERSION file must contain a strict X.Y.Z version, got \"$VERSION\"" >&2
  exit 1
fi

npm pkg set version="$VERSION" --no-git-tag-version --prefix "$ROOT_DIR/frontend"
npm pkg set version="$VERSION" --no-git-tag-version --prefix "$ROOT_DIR/dashboard"

# Targeted text substitution (not json.load/dump) everywhere below so
# unrelated formatting — the compact single-line "requirements" array in
# manifest.json, npm's exact key ordering in the lockfile — is left untouched.
# (Not using `npm install --package-lock-only` for the lockfile: it also
# rewrites unrelated optional-dependency metadata depending on the local npm
# version, which is noise we don't want in a version-only commit.)

python3 - "$ROOT_DIR/custom_components/daynest/manifest.json" "$VERSION" <<'EOF'
import re
import sys

path, version = sys.argv[1], sys.argv[2]
with open(path) as f:
    content = f.read()
new_content, count = re.subn(r'"version":\s*"[^"]+"', f'"version": "{version}"', content)
if count != 1:
    sys.exit(f"Expected exactly one \"version\" field in {path}, found {count}")
with open(path, "w") as f:
    f.write(new_content)
EOF

# dashboard/package-lock.json mirrors package.json's version in two spots
# (top level + the "" root package entry). frontend/pnpm-lock.yaml doesn't
# embed the root package's own version, so it needs no update; frontend's
# package-lock.json is a stale leftover from before the pnpm switch and is
# intentionally left alone here.
python3 - "$ROOT_DIR/dashboard/package-lock.json" "$VERSION" <<'EOF'
import re
import sys

path, version = sys.argv[1], sys.argv[2]
with open(path) as f:
    content = f.read()
new_content, count = re.subn(
    r'("name": "daynest-card",\s*\n\s*"version": ")[^"]+(")',
    rf'\g<1>{version}\g<2>',
    content,
)
if count != 2:
    sys.exit(f"Expected exactly two name/version pairs for daynest-card in {path}, found {count}")
with open(path, "w") as f:
    f.write(new_content)
EOF

echo "Synced VERSION ($VERSION) to frontend/package.json, dashboard/package.json, dashboard/package-lock.json, and manifest.json"
