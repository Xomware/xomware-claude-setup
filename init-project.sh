#!/usr/bin/env bash
# DEPRECATED — use bin/init-claude-setup instead
# This script redirects to the new location for backwards compatibility.

echo "⚠️  init-project.sh is deprecated. Use bin/init-claude-setup instead."
echo ""
echo "Quick setup (one time):"
echo "  bash setup.sh              # symlinks bin/ commands to ~/.local/bin/"
echo "  init-claude-setup          # then use directly"
echo ""
echo "Or run directly:"
echo "  bin/init-claude-setup [--force] [--dry-run]"
echo ""
echo "Redirecting..."
echo ""

exec "$(dirname "$0")/bin/init-claude-setup" "$@"
