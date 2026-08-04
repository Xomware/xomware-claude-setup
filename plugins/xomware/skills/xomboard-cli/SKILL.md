---
name: xomboard-cli
description: >
  Programmatically manage XomBoard (GitHub Projects #2) — read board state, move cards
  between Backlog / Up Next / In Progress / In Review / Done, and update assignees and
  labels. Use for bulk or scripted board work; /board is the quick read-only view.
disable-model-invocation: true
argument-hint: "[list|move|status] [args]"
allowed-tools: Read Bash(gh api:*) Bash(gh project:*) Bash(python3:*)
---

# XomBoard CLI - Programmatic Kanban Management

## Overview

XomBoard is a local kanban board that syncs with GitHub Projects and the XomBoard API. This skill provides Python and shell-based tools to:

- Fetch current board state and card data
- Move cards between columns (Backlog → Up Next → In Progress → In Review → Done, etc.)
- Update card properties (assignees, descriptions, labels)
- Sync changes back to GitHub Projects and the XomBoard API
- Query board status for agent workflows

## Board Structure

XomBoard columns (in order):
1. **Backlog** - Tasks assigned to Dom with action required
2. **Done** - Tasks completed by Dom
3. **In Review** - Tasks waiting for Dom's decision
4. **Up Next** - Tasks ready to start
5. **In Progress** - Currently being worked on
6. **In Review** - Waiting for review/approval
7. **Done** - Completed tasks

Each card maps to a GitHub Issue in the Xomware org.

## Quick Start

### Python API

```python
from xomboard_cli import XomBoardClient

# Initialize client (reads auth from ~/.xomboard/config.json)
board = XomBoardClient()

# Get all cards
cards = board.get_cards()
for card in cards:
    print(f"{card['title']} -> {card['column']}")

# Move a card
board.move_card(
    card_id="GH_12345",  # GitHub issue ID or card ID
    target_column="In Progress",
    sync=True  # Automatically sync to GitHub Projects and API
)

# Update card properties
board.update_card(
    card_id="GH_12345",
    assignee="domgiordano",
    description="Updated task description",
    labels=["bug", "urgent"],
    sync=True
)

# Get board status
status = board.get_status()
print(f"Total cards: {status['total']}")
print(f"By column: {status['by_column']}")

# Sync to GitHub Projects and API
board.sync()
```

### Shell CLI

```bash
# Get board status
xomboard status

# List all cards
xomboard list

# Move a card
xomboard move GH_12345 "In Progress"

# Update a card
xomboard update GH_12345 \
  --assignee domgiordano \
  --description "Task description" \
  --labels bug,urgent

# Sync to API
xomboard sync

# Get a specific card
xomboard get GH_12345

# Filter cards by column
xomboard list --column "Up Next"
```

## Configuration

XomBoard reads config from `~/.xomboard/config.json`:

```json
{
  "api_base": "https://api.xomware.com",
  "api_auth_hash": "YOUR_AUTH_HASH_HERE",
  "github_token": "ghp_...",
  "project_id": "PVT_kwDOD63LP84BPziU",
  "board_owner": "Xomware",
  "status_field_id": "PVTSSF_lADOD63LP84BPziUzg-G7i8",
  "columns": {
    "Backlog": "dfec8e4f",
    "Up Next": "841d46a7",
    "In Progress": "ce09eedb",
    "In Review": "322a35f9",
    "Done": "76b606f7"
  }
}
```

## Usage in Agent Workflows

### Example: Spawn a task and track it

```python
from xomboard_cli import XomBoardClient

board = XomBoardClient()

# Create a new GitHub issue (or get existing)
issue_url = "https://github.com/Xomware/repo/issues/42"
issue_id = "GH_42"

# Add to Dom's todo
board.move_card(issue_id, "Backlog")
board.update_card(
    issue_id, 
    assignee="domgiordano",
    description="Implement feature X. Sub-agent is working on this."
)

# When sub-agent completes, move to Done
board.move_card(issue_id, "Done")
board.update_card(issue_id, description="Completed by sub-agent-xyz")
```

### Example: Check board capacity before spawning work

```python
board = XomBoardClient()

# Check how many items are "In Progress"
status = board.get_status()
in_progress = status['by_column'].get('In Progress', 0)

if in_progress < 3:
    # Spawn sub-agent for new task
    pass
else:
    # Wait for capacity
    pass
```

## Advanced Features

### Batch Operations

```python
# Move multiple cards at once
board.batch_move([
    ("GH_100", "In Progress"),
    ("GH_101", "In Progress"),
    ("GH_102", "In Review"),
])

# Update multiple cards
board.batch_update([
    {"id": "GH_100", "assignee": "user1"},
    {"id": "GH_101", "assignee": "user2"},
])
```

### Filtering and Querying

```python
# Get cards in a specific column
todo_cards = board.get_cards(column="Up Next")

# Get cards assigned to a user
dom_cards = board.get_cards(assignee="domgiordano")

# Get cards with a specific label
bugs = board.get_cards(label="bug")

# Combine filters
blocked = board.get_cards(
    column="In Review",
    assignee=None
)
```

### Sync Behavior

By default, operations are **local-only** until you call `.sync()` or pass `sync=True`:

```python
# Local only
board.move_card(card_id, "In Progress")

# Automatic sync
board.move_card(card_id, "In Progress", sync=True)

# Manual sync
board.move_card(card_id, "In Progress")
board.sync()
```

## Troubleshooting

**Auth issues:** Ensure `~/.xomboard/config.json` has valid `api_auth_hash` and `github_token`.

**Sync failures:** Check GitHub Projects is accessible and the project ID is correct.

**API errors:** Verify the XomBoard API is running at the configured `api_base`.

## See Also

- **references/** - Complete Python API reference and CLI examples
- **scripts/xomboard-cli.py** - Main CLI implementation
- **scripts/xomboard_lib.py** - Python library for integrations
