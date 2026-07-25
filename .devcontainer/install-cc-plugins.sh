#!/usr/bin/env bash
# Reinstalls the Claude Code plugins this project relies on.
# Run after a devcontainer rebuild (plugins live in ~/.claude, which is wiped on rebuild).
#
# Regenerate the plugin list after enabling/disabling plugins with:
#   claude plugin list --json | jq -r '.[].id'

set -euo pipefail

trap 'echo "[ install-cc-skills ] failed at line $LINENO" >&2' ERR

log() {
  echo "[ install-cc-plugins ] $*"
}

if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found on PATH; skipping plugin installation." >&2
    exit 0
fi

log "Installing Claude Code plugins"

MARKETPLACES=(
    "anthropics/claude-plugins-official"
)

PLUGINS=(
    "commit-commands@claude-plugins-official"
    "superpowers@claude-plugins-official"
    "serena@claude-plugins-official"
    "chrome-devtools-mcp@claude-plugins-official"
    "claude-code-setup@claude-plugins-official"
    "typescript-lsp@claude-plugins-official"
    "security-guidance@claude-plugins-official"
    "claude-md-management@claude-plugins-official"
    "playwright@claude-plugins-official"
    "github@claude-plugins-official"
    "code-simplifier@claude-plugins-official"
    "code-review@claude-plugins-official"
    "frontend-design@claude-plugins-official"
    "serena@claude-plugins-official"
)

for marketplace in "${MARKETPLACES[@]}"; do
    log "Adding marketplace: ${marketplace}"
    claude plugin marketplace add "${marketplace}"
done

for plugin in "${PLUGINS[@]}"; do
    log "Installing plugin: ${plugin}"
    claude plugin install "${plugin}"
done

log "Claude Code plugins installed."
