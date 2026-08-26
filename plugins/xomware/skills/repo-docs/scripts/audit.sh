#!/usr/bin/env bash
# audit.sh — doc coverage for one repo, or for every repo under a directory.
#
#   audit.sh                 # the repo in $PWD, one line
#   audit.sh ~/dev/lumist     # every git repo one level down, as a table
#
# Counts DOCUMENTATION, not filenames. The audit this script replaces looked only for
# CLAUDE.md and docs/architecture.md, and on that basis reported github-actions as having
# no docs — it has a 136-line README, a 130-line CONTRIBUTING, a 122-line RELEASING and
# 620 lines of runbooks under docs/runbooks/, and uses AGENTS.md rather than CLAUDE.md.
#
# Columns:
#   SRC     non-test, non-generated source lines. Under ~300 the repo is a scaffold and an
#           architecture doc would document an intention, not a system.
#   INSTR   CLAUDE.md / .claude/CLAUDE.md / AGENTS.md  (any one counts)
#   ARCH    docs/architecture.md — `stub` if template placeholders are still in it
#   RUN     docs/runbook.md, or a count of docs/runbooks/*.md
#   OTHER   README / CONTRIBUTING / RELEASING lines that already carry weight
#   W       ✓ if any doc declares watches: frontmatter (staleness tracking is live)
#   AGE     days since last commit — 120+ means dormant, don't invest
#
# Bash 3 compatible (macOS): no associative arrays.

set -u

human_days() {
  local last now
  last="$(git -C "$1" log -1 --format=%ct 2>/dev/null || echo 0)"
  now="$(date +%s)"
  [ "$last" = "0" ] && { echo "-"; return; }
  echo $(( (now - last) / 86400 ))
}

count_src() {
  # Source lines excluding tests, generated output, vendored deps and lockfiles.
  find "$1" \
    \( -name .git -o -name node_modules -o -name _build -o -name deps -o -name .venv \
       -o -name __pycache__ -o -name .next -o -name dist -o -name build \
       -o -name test -o -name tests -o -name spec \) -prune -o \
    \( -name '*.ex' -o -name '*.exs' -o -name '*.py' -o -name '*.ts' -o -name '*.tsx' \
       -o -name '*.js' -o -name '*.jsx' -o -name '*.go' -o -name '*.swift' \
       -o -name '*.tf' -o -name '*.sh' -o -name '*.yml' \) -type f -print0 2>/dev/null \
  | xargs -0 wc -l 2>/dev/null | tail -1 | awk '{print ($1 == "") ? 0 : $1}'
}

lines() { [ -f "$1" ] && wc -l < "$1" | tr -d ' ' || echo 0; }

audit_one() {
  local r="$1" name="$2"

  local src instr arch run other w age
  src="$(count_src "$r")"
  [ -z "$src" ] && src=0

  instr="-"
  for f in CLAUDE.md .claude/CLAUDE.md AGENTS.md; do
    if [ -f "$r/$f" ] && [ "$(lines "$r/$f")" -gt 5 ]; then
      instr="$(basename "$f" .md)"
      [ "$f" = ".claude/CLAUDE.md" ] && instr="CLAUDE(.claude)"
      break
    fi
  done

  arch="-"
  if [ -f "$r/docs/architecture.md" ]; then
    arch="$(lines "$r/docs/architecture.md")L"
    if grep -q '\[Project Name\]\|\[High-level description\|\[why\]' "$r/docs/architecture.md" 2>/dev/null; then
      arch="$arch stub"
    fi
  fi

  run="-"
  if [ -f "$r/docs/runbook.md" ]; then
    run="$(lines "$r/docs/runbook.md")L"
  else
    local n
    n="$(ls "$r"/docs/runbooks/*.md 2>/dev/null | wc -l | tr -d ' ')"
    [ "$n" != "0" ] && run="runbooks/×$n"
  fi

  other=0
  for f in README.md CONTRIBUTING.md RELEASING.md; do
    other=$(( other + $(lines "$r/$f") ))
  done
  [ "$other" = "0" ] && other="-" || other="${other}L"

  w="-"
  grep -lsq . /dev/null 2>/dev/null # no-op, keeps set -u happy on old bash
  if grep -rls '^watches:' "$r/docs" "$r/CLAUDE.md" "$r/.claude/CLAUDE.md" 2>/dev/null | head -1 | grep -q .; then
    w="✓"
  fi

  age="$(human_days "$r")"

  printf "%-42s %8s  %-15s %-12s %-13s %-7s %-2s %5s\n" \
    "$name" "$src" "$instr" "$arch" "$run" "$other" "$w" "$age"
}

header() {
  printf "%-42s %8s  %-15s %-12s %-13s %-7s %-2s %5s\n" \
    REPO SRC INSTR ARCH RUN OTHER W AGE
  printf '%.0s─' $(seq 1 108); echo
}

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  header
  audit_one "$root" "$(basename "$root")"
  exit 0
fi

header
for d in "$TARGET"/*/; do
  r="${d%/}"
  [ -d "$r/.git" ] || continue
  audit_one "$r" "$(basename "$r")"
done
