#!/usr/bin/env bash
# ==============================================================================
# GraviQuota - Antigravity Token Extractor (Bash / Multi-platform)
# Automatically extracts your active Antigravity Bearer or Refresh token and
# copies it to your system clipboard for fast synchronization with GraviQuota.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WANT_REFRESH=false

for arg in "$@"; do
  case "$arg" in
    --refresh|-r)
      WANT_REFRESH=true
      shift
      ;;
  esac
done

copy_to_clipboard() {
  local content="$1"
  if command -v pbcopy >/dev/null 2>&1; then
    printf "%s" "$content" | pbcopy
    return 0
  elif command -v xclip >/dev/null 2>&1; then
    printf "%s" "$content" | xclip -selection clipboard
    return 0
  elif command -v xsel >/dev/null 2>&1; then
    printf "%s" "$content" | xsel --clipboard --input
    return 0
  elif command -v clip.exe >/dev/null 2>&1; then
    printf "%s" "$content" | clip.exe
    return 0
  else
    return 1
  fi
}

OS="$(uname -s 2>/dev/null || echo "Unknown")"

echo "==> Detecting operating system: ${OS}..."

# Case 1: Windows running under Git Bash / MSYS / MINGW / WSL
if [[ "$OS" =~ MINGW|MSYS|CYGWIN ]] || [[ -f /proc/version && $(cat /proc/version) =~ Microsoft|WSL ]]; then
  echo "==> Running in Windows environment. Executing PowerShell reader..."
  PWSH="powershell.exe"
  if ! command -v "$PWSH" >/dev/null 2>&1; then
    PWSH="powershell"
  fi

  FLAGS=()
  if [ "$WANT_REFRESH" = true ]; then
    FLAGS+=("-RefreshToken")
  fi

  if command -v cygpath >/dev/null 2>&1; then
    WIN_SCRIPT_PATH="$(cygpath -w "${SCRIPT_DIR}/copy-token.ps1")"
  elif command -v wslpath >/dev/null 2>&1; then
    WIN_SCRIPT_PATH="$(wslpath -w "${SCRIPT_DIR}/copy-token.ps1")"
  else
    WIN_SCRIPT_PATH="${SCRIPT_DIR}/copy-token.ps1"
  fi

  "$PWSH" -ExecutionPolicy Bypass -File "$WIN_SCRIPT_PATH" "${FLAGS[@]}"
  exit 0
fi

# Case 2: macOS
if [[ "$OS" == "Darwin" ]]; then
  echo "==> Checking macOS Keychain for Antigravity credentials..."
  RAW_PAYLOAD=""
  
  if RAW_PAYLOAD="$(security find-generic-password -s "gemini:antigravity" -w 2>/dev/null)"; then
    :
  elif RAW_PAYLOAD="$(security find-generic-password -s "antigravity" -w 2>/dev/null)"; then
    :
  fi

  if [[ -z "$RAW_PAYLOAD" ]]; then
    echo "Error: No Antigravity credentials found in macOS Keychain." >&2
    echo "Please ensure you have launched and logged into Antigravity IDE on this machine." >&2
    exit 1
  fi

  # Extract token using node or python3
  EXTRACTED_TOKEN=""
  if command -v node >/dev/null 2>&1; then
    EXTRACTED_TOKEN=$(node -e "
      const data = JSON.parse(process.argv[1]);
      const token = $WANT_REFRESH ? (data?.token?.refresh_token || data?.token?.access_token) : (data?.token?.access_token || data?.token?.refresh_token);
      process.stdout.write(token || '');
    " "$RAW_PAYLOAD")
  elif command -v python3 >/dev/null 2>&1; then
    EXTRACTED_TOKEN=$(python3 -c "
import sys, json
data = json.loads(sys.argv[1])
t = data.get('token', {})
token = t.get('refresh_token') if '$WANT_REFRESH' == 'true' else t.get('access_token')
if not token:
    token = t.get('access_token') or t.get('refresh_token')
sys.stdout.write(token or '')
    " "$RAW_PAYLOAD")
  fi

  if [[ -z "$EXTRACTED_TOKEN" ]]; then
    echo "Error: Could not extract valid token from credential payload." >&2
    exit 1
  fi

  copy_to_clipboard "$EXTRACTED_TOKEN"
  echo "Token successfully copied to your clipboard!"
  echo "Paste it into the GraviQuota token input to synchronize your quota."
  exit 0
fi

# Case 3: Linux
if [[ "$OS" == "Linux" ]]; then
  echo "==> Checking Linux Secret Service / Keyring..."
  RAW_PAYLOAD=""
  if command -v secret-tool >/dev/null 2>&1; then
    RAW_PAYLOAD="$(secret-tool lookup service "gemini:antigravity" 2>/dev/null || true)"
  fi

  if [[ -z "$RAW_PAYLOAD" ]]; then
    echo "Error: No credentials found via secret-tool." >&2
    echo "Ensure libsecret is installed and you are signed into Antigravity IDE." >&2
    exit 1
  fi

  EXTRACTED_TOKEN=$(node -e "
    const data = JSON.parse(process.argv[1]);
    const token = $WANT_REFRESH ? (data?.token?.refresh_token || data?.token?.access_token) : (data?.token?.access_token || data?.token?.refresh_token);
    process.stdout.write(token || '');
  " "$RAW_PAYLOAD")

  if copy_to_clipboard "$EXTRACTED_TOKEN"; then
    echo "Token successfully copied to your clipboard!"
  else
    echo "Token: $EXTRACTED_TOKEN"
    echo "(Could not auto-copy to clipboard. Install xclip or xsel for auto-copying)."
  fi
  exit 0
fi

echo "Error: Unsupported operating system: ${OS}" >&2
exit 1
