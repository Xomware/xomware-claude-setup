#!/usr/bin/env bash
# DEPRECATED — use bin/install-claude-setup instead
# This script redirects to the new location for backwards compatibility.

echo "⚠️  install.sh is deprecated. Use bin/install-claude-setup instead."
echo ""
echo "Quick setup (one time):"
echo "  bash setup.sh              # symlinks bin/ commands to ~/.local/bin/"
echo "  install-claude-setup       # then use directly"
echo ""
echo "Or run directly:"
echo "  bin/install-claude-setup [--force] [--dry-run]"
echo ""
echo "Redirecting..."
echo ""

exec "$(dirname "$0")/bin/install-claude-setup" "$@"
