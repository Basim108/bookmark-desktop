#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[postCreateCommands] $*"
}

trap 'echo "[postCreateCommands] failed at line $LINENO" >&2' ERR

log "Checking prerequisites"
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }

log "Installing claude-code"
npm install -g --no-audit --no-fund @anthropic-ai/claude-code@2.1.201

log "Installing openspec"
npm install -g --no-audit --no-fund @fission-ai/openspec@1.5.0

log "Installing project dependencies"
npm install --no-fund

log "Installing Playwright's Chromium (needed for npm run test:e2e)"
npx playwright install --with-deps chromium

log "Installing pipx (needed for Semgrep, avoids Debian's PEP 668 system-Python restriction)"
if ! command -v pipx >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq pipx
fi

# The devcontainer python feature sets PIPX_HOME/PIPX_BIN_DIR to /usr/local/py-utils,
# but (with installTools disabled) never creates/chowns that root-owned directory, so
# pipx can't write there as the non-root user. Use a user-writable location instead.
export PIPX_HOME="$HOME/.local/pipx"
export PIPX_BIN_DIR="$HOME/.local/bin"
pipx ensurepath

log "Installing Semgrep (SEC-11.3 dangerous-function/pattern scan; see SECURITY.md)"
pipx install --force "semgrep==1.168.0"