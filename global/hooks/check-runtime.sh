#!/usr/bin/env bash
# check-runtime.sh
# Called by install.sh to verify hook dependencies are available.
# Prints warnings for missing runtimes — does NOT fail hard.

WARN="\033[33m[claude-hooks WARNING]\033[0m"
OK="\033[32m[claude-hooks OK]\033[0m"

check() {
  local cmd="$1"
  local label="$2"
  local install_hint="$3"
  if command -v "$cmd" &>/dev/null; then
    echo -e "$OK $label found: $(command -v $cmd)"
  else
    echo -e "$WARN $label not found. Hooks using $cmd will silently skip."
    echo -e "       Install: $install_hint"
  fi
}

check "node"   "Node.js"  "https://nodejs.org or: brew install node"
check "python3" "Python 3" "https://python.org or: brew install python"
check "elixir"  "Elixir"   "https://elixir-lang.org or: brew install elixir"

echo ""
echo "Note: Missing runtimes won't break Claude Code — hooks exit 0 when runtime unavailable."
