#!/usr/bin/env bash
# ==============================================================================
# GraviQuota - Independent Google Login CLI (Bash)
# Authenticates directly with Google OAuth without requiring Antigravity IDE.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run Node.js login script with any passed arguments (e.g. --local)
if command -v bun >/dev/null 2>&1; then
  bun "${SCRIPT_DIR}/login.mjs" "$@"
elif command -v node >/dev/null 2>&1; then
  node "${SCRIPT_DIR}/login.mjs" "$@"
else
  echo "Error: Neither node nor bun was found in PATH. Please install Node.js or Bun." >&2
  exit 1
fi
