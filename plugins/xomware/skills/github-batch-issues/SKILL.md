---
name: github-batch-issues
description: >
  Create several related GitHub issues at once from templates, add them to XomBoard, set
  labels, assignees and milestones, and link parent-child relationships. Use for epic
  breakdowns and sprint planning; /backlog handles a single issue.
disable-model-invocation: true
argument-hint: "[epic name or template]"
allowed-tools: Read Bash(gh issue:*) Bash(gh api:*) Bash(python3:*)
---

# GitHub Batch Issues - Bulk Issue Creation & Management

## Overview

This skill provides tools to efficiently create batches of related GitHub issues with consistent formatting and metadata. Use it for:

- Breaking down epics into subtasks
- Creating sprint backlogs
- Bulk bug or feature tracking
- Documentation or testing checklists
- Establishing parent-child issue relationships

## Key Features

- **Template-based creation** - Define issue structure once, create many
- **XomBoard integration** - Auto-add issues to kanban on creation
- **Metadata automation** - Apply labels, assignees, milestones consistently
- **Relationship linking** - Create parent-child hierarchies
- **Batch operations** - Create 5-100 issues in one command
- **Safety checks** - Validate templates before creation

## Quick Start

### CLI Usage

```bash
# Create issues from YAML template
github-batch-issues create \
  --template issues-template.yaml \
  --repo Xomware/myproject \
  --add-to-board

# Create with specific assignee and labels
github-batch-issues create \
  --template issues-template.yaml \
  --repo Xomware/myproject \
  --assignee domgiordano \
  --labels "backend,bug" \
  --add-to-board

# Create with milestone
github-batch-issues create \
  --template issues-template.yaml \
  --repo Xomware/myproject \
  --milestone "Sprint 2025-03" \
  --add-to-board

# Link issues as parent-child
github-batch-issues link \
  --parent GH_123 \
  --children GH_124,GH_125,GH_126 \
  --repo Xomware/myproject

# List created issues
github-batch-issues list \
  --template-id my-epic-2025-03 \
  --repo Xomware/myproject
```

### Python API

```python
from github_batch_issues import BatchIssueCreator

creator = BatchIssueCreator(token="ghp_...", owner="Xomware")

# Create from template
results = creator.create_from_template(
    template_file="issues.yaml",
    repo="myproject",
    assignee="domgiordano",
    labels=["backend", "implementation"],
    milestone="Sprint 2025-03",
    add_to_board=True
)

# Process results
for result in results:
    if result['success']:
        print(f"✓ Created {result['issue_number']}: {result['title']}")
    else:
        print(f"✗ Failed: {result['error']}")

# Link as parent-child
creator.link_issues(
    parent_id=123,
    children_ids=[124, 125, 126],
    repo="myproject"
)
```

## Template Format

### Basic YAML Template

```yaml
# issues.yaml
template_id: "epic-user-auth-2025-03"
description: "Authentication system overhaul"
repo: "Xomware/auth-service"
default_labels:
  - "feature"
  - "backend"

issues:
  - title: "Design OAuth2 flow"
    description: |
      Design the OAuth2 authentication flow for the application.
      
      - [ ] Design flow diagram
      - [ ] Document security considerations
      - [ ] Get design review
    assignee: null
    labels: ["design", "documentation"]
    
  - title: "Implement OAuth2 provider integration"
    description: |
      Implement OAuth2 provider (Google, Apple) integration.
      
      - [ ] Google OAuth
      - [ ] Apple OAuth
      - [ ] Token refresh
      - [ ] Error handling
    assignee: "domgiordano"
    labels: ["implementation"]
    
  - title: "Add unit tests for authentication"
    description: |
      Add comprehensive unit tests for the authentication module.
      
      - [ ] OAuth flow tests
      - [ ] Token validation tests
      - [ ] Error scenarios
    assignee: "JarvisXomware"
    labels: ["testing"]
    
  - title: "Integration tests for OAuth flows"
    description: "End-to-end integration testing of OAuth flows"
    depends_on: 1  # References issue 1 (0-indexed)
    
  - title: "Documentation: OAuth setup guide"
    description: |
      Write setup and configuration guide for OAuth authentication.
      
      Include:
      - Prerequisite setup
      - Configuration examples
      - Troubleshooting
    labels: ["documentation"]
```

### Advanced Template with Relationships

```yaml
template_id: "feature-mobile-app-2025-q1"
description: "Mobile app feature set"
repo: "Xomware/mobile"

# Hierarchy: parent issue creates subtasks
parent_issue:
  title: "[Epic] Mobile App Feature Set"
  description: "Tracking issue for all mobile app work"
  labels: ["epic", "mobile"]

issues:
  # Parent: Design Phase
  - title: "[Phase] Design & Specification"
    type: "phase"
    description: "Design phase for mobile app"
    order: 1
    
  - title: "Design UI mockups"
    phase: 1
    description: "Create UI mockups for all screens"
    assignee: "designer"
    
  - title: "Design data models"
    phase: 1
    description: "Define app data structures"
    
  # Parent: Implementation
  - title: "[Phase] Implementation"
    type: "phase"
    description: "Implementation phase"
    order: 2
    
  - title: "Implement authentication screen"
    phase: 2
    depends_on: ["design-ui-mockups"]
    description: "Build login/signup flows"
    assignee: "domgiordano"
    
  - title: "Implement home screen"
    phase: 2
    depends_on: ["design-ui-mockups"]
    description: "Build home screen UI and logic"
    
  - title: "Implement API client"
    phase: 2
    depends_on: []
    description: "Build API integration layer"
    assignee: "backend-engineer"
    
  # Parent: Testing
  - title: "[Phase] Testing"
    type: "phase"
    description: "Testing phase"
    order: 3
    
  - title: "Unit tests for API client"
    phase: 3
    depends_on: ["implement-api-client"]
    assignee: "qa-engineer"
    
  - title: "E2E tests"
    phase: 3
    depends_on: ["implement-authentication-screen", "implement-home-screen"]
    assignee: "qa-engineer"
```

## Creating Issues from Templates

### From CLI

```bash
# Simple batch creation
github-batch-issues create \
  --template auth-issues.yaml \
  --add-to-board

# With additional metadata
github-batch-issues create \
  --template auth-issues.yaml \
  --milestone "March 2025" \
  --assignee domgiordano \
  --labels "high-priority" \
  --add-to-board \
  --verbose

# Dry run to preview
github-batch-issues create \
  --template auth-issues.yaml \
  --dry-run
```

### From Python

```python
creator = BatchIssueCreator(token="...", owner="Xomware")

# Create with template
results = creator.create_from_template(
    template_file="auth-issues.yaml",
    repo="auth-service",
    add_to_board=True,
    assignee_override="domgiordano",
    label_override=["urgent"],
    milestone="March 2025"
)

# Handle results
successful = [r for r in results if r['success']]
failed = [r for r in results if not r['success']]

print(f"Created: {len(successful)}/{len(results)}")
for r in failed:
    print(f"Failed: {r['title']} - {r['error']}")

# Extract issue numbers for further use
issue_numbers = [r['issue_number'] for r in successful]
```

## Linking Issues

### Parent-Child Relationships

```bash
# Make issue 200 the parent of 201, 202, 203
github-batch-issues link \
  --parent 200 \
  --children 201,202,203 \
  --repo Xomware/project
```

### Dependency Relationships

```python
creator = BatchIssueCreator(token="...", owner="Xomware")

# Create dependency links
creator.add_dependency(
    dependent_issue=202,  # This depends on...
    blocking_issue=201,   # ...this one
    repo="project"
)

# Mark blocking relationships
creator.add_blocking(
    blocking_issue=201,
    blocked_issues=[202, 203],
    repo="project"
)
```

## XomBoard Integration

### Auto-add to Board

When creating issues with `--add-to-board`, they are automatically added to XomBoard in the **Up Next** column:

```bash
github-batch-issues create \
  --template issues.yaml \
  --add-to-board \
  --default-column "Up Next"
```

### Manual Board Integration

```python
from github_batch_issues import BatchIssueCreator
from xomboard_cli import XomBoardClient

creator = BatchIssueCreator(token="...", owner="Xomware")
board = XomBoardClient()

# Create issues
results = creator.create_from_template(
    "issues.yaml",
    repo="project"
)

# Add to board
for result in results:
    if result['success']:
        board.move_card(
            f"GH_{result['issue_number']}",
            "Up Next",
            sync=False
        )

# Sync all at once
board.sync()
```

## Validation & Safety

### Validate Template Before Creating

```bash
github-batch-issues validate --template issues.yaml

# Output:
# ✓ Template valid
# - 5 issues to create
# - Assignees: domgiordano, JarvisXomware, designer
# - Labels: feature, backend, design, documentation
# - Default repo: Xomware/auth-service
```

### Dry Run

```bash
github-batch-issues create \
  --template issues.yaml \
  --dry-run

# Shows what would be created without creating anything
```

## Examples

### Sprint Planning

```yaml
# sprint-backlog.yaml
template_id: "sprint-2025-03-backlog"
description: "Sprint March 3-14, 2025"
repo: "Xomware/product"

issues:
  - title: "User profile page redesign"
    description: "Refresh profile page UI/UX"
    assignee: "designer"
    labels: ["feature", "ui"]
    
  - title: "Add dark mode support"
    description: "Implement dark mode toggle and persistence"
    assignee: "domgiordano"
    labels: ["feature", "frontend"]
    
  - title: "Optimize API response times"
    description: "Profile bottlenecks and optimize queries"
    assignee: "backend-engineer"
    labels: ["performance", "backend"]
    
  - title: "Write API documentation"
    description: "Complete OpenAPI spec documentation"
    assignee: "tech-writer"
    labels: ["documentation"]
```

### Bug Triage

```yaml
# bug-batch.yaml
template_id: "2025-03-bug-triage"
description: "Critical bugs found in QA"
repo: "Xomware/core"
default_labels: ["bug"]

issues:
  - title: "[Critical] Login fails on iOS 15"
    description: "OAuth flow fails on iOS 15.x devices"
    labels: ["critical", "ios"]
    assignee: "mobile-engineer"
    
  - title: "[High] Memory leak in analytics"
    description: "Memory usage grows unbounded during extended use"
    labels: ["high-priority", "performance"]
    assignee: "backend-engineer"
    
  - title: "Typo in settings page"
    description: "Fix: 'Prefernce' should be 'Preference'"
    labels: ["low-priority", "ui"]
```

## Advanced Workflows

### Create with Sub-agent Spawning

```python
from github_batch_issues import BatchIssueCreator
import subprocess

creator = BatchIssueCreator(token="...", owner="Xomware")

# Create implementation tasks
results = creator.create_from_template(
    "implementation-tasks.yaml",
    repo="myproject",
    add_to_board=True
)

# Spawn sub-agent for each task
for result in results:
    if result['success']:
        issue_num = result['issue_number']
        subprocess.run([
            "openclaw", "spawn", "forge-implementation",
            "--task", f"Implement task from GitHub issue #{issue_num}",
            "--label", f"gh:issue:{issue_num}"
        ])
```

### Template Variables

```yaml
# Use variables in templates
template_id: "{{ release }}-tasks"
description: "Tasks for {{ release }} release"
repo: "Xomware/{{ repo_name }}"

issues:
  - title: "{{ release }} - Feature implementation"
    description: |
      Implement features for {{ release }}
      Release date: {{ release_date }}
    milestone: "{{ release }}"
```

## See Also

- **references/** - Complete API reference and template examples
- **scripts/github-batch-issues.py** - Main CLI/library implementation
- **references/templates/** - Pre-built templates for common workflows
