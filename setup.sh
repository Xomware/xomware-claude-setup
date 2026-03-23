#!/usr/bin/env bash
# setup.sh
# Makes install-claude-setup, init-claude-setup, and update-claude-setup
# available as global commands by symlinking to ~/.local/bin/

set -euo pipefail

BIN_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bin"

echo "Setting up global Claude Code commands..."
echo ""

mkdir -p "$BIN_DIR"

for cmd in claude-setup install-claude-setup init-claude-setup update-claude-setup; do
  src="$SCRIPT_DIR/$cmd"
  dst="$BIN_DIR/$cmd"

  chmod +x "$src"

  if [[ -L "$dst" ]] || [[ -f "$dst" ]]; then
    echo "  Replacing: $dst -> $src"
    ln -sf "$src" "$dst"
  else
    echo "  Linked:    $dst -> $src"
    ln -s "$src" "$dst"
  fi
done

# Check if ~/.local/bin is on PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "$HOME/.local/bin"; then
  echo ""
  echo "~/.local/bin is not on your PATH. Add this to your ~/.zshrc:"
  echo ""
  echo '  export PATH="$HOME/.local/bin:$PATH"'
  echo ""
  echo "Then run: source ~/.zshrc"
else
  echo ""
  echo "All commands are ready to use:"
  echo "  claude-setup              Dashboard + interactive manager"
  echo "  install-claude-setup      Install global config to ~/.claude/"
  echo "  init-claude-setup         Scaffold .claude/ in current project"
  echo "  update-claude-setup       Scan projects and surface improvements"
fi
