#!/usr/bin/env bash
# setup.sh
# Symlinks the xom-* commands in bin/ into ~/.local/bin/ so they are globally
# available, and removes the unprefixed symlinks left behind by the pre-fork
# DominickGiordano/claude-setup repo.

set -euo pipefail

BIN_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bin"

echo "Setting up global Claude Code commands..."
echo ""

mkdir -p "$BIN_DIR"

# Remove stale unprefixed links from the old repo. They shadow nothing now, but
# running one would overwrite ~/.claude/ from a repo that still carries Areté
# content. Only remove symlinks — never a real file someone put there.
for stale in claude-setup install-claude-setup init-claude-setup update-claude-setup; do
  dst="$BIN_DIR/$stale"
  if [[ -L "$dst" ]]; then
    target="$(readlink "$dst")"
    case "$target" in
      "$SCRIPT_DIR"/*) ;;
      *)
        echo "  Removing stale: $dst -> $target"
        rm "$dst"
        ;;
    esac
  fi
done

for cmd in xom-claude-setup xom-install-claude-setup xom-init-claude-setup xom-update-claude-setup; do
  src="$SCRIPT_DIR/$cmd"
  dst="$BIN_DIR/$cmd"

  if [[ ! -f "$src" ]]; then
    echo "  Missing:   $src (skipped)" >&2
    continue
  fi

  chmod +x "$src"

  if [[ -L "$dst" ]] || [[ -f "$dst" ]]; then
    echo "  Replacing: $dst -> $src"
  else
    echo "  Linked:    $dst -> $src"
  fi
  ln -sfn "$src" "$dst"
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
  echo "  xom-claude-setup              Dashboard + interactive manager"
  echo "  xom-install-claude-setup      Install global config to ~/.claude/"
  echo "  xom-init-claude-setup         Scaffold .claude/ in current project"
  echo "  xom-update-claude-setup       Scan projects and surface improvements"
fi
