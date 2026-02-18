---
name: fulcrum
description: AI orchestration and task management platform. Use this skill when working in a Fulcrum task worktree, managing tasks/projects, or interacting with the Fulcrum server.
---

# Fulcrum - AI Orchestration Platform

## When to Use This Skill

Use the Fulcrum CLI when:
- **Working in a task worktree** — Use `current-task` commands to manage your current task
- **Updating task status** — Mark tasks as in-progress, ready for review, done, or canceled
- **Linking PRs** — Associate a GitHub PR with the current task
- **Linking URLs** — Attach relevant URLs (design docs, specs, external resources) to the task
- **Sending notifications** — Alert the user when work is complete or needs attention
- **Server management** — Start, stop, and check server status
- **API access** — Query or modify any Fulcrum data via `fulcrum api`

## CLI Commands

### current-task (Primary Agent Workflow)

When running inside a Fulcrum task worktree, manage the current task:

```bash
fulcrum current-task                          # Get full task info
fulcrum current-task in-progress              # Mark as IN_PROGRESS
fulcrum current-task review                   # Mark as IN_REVIEW (notifies user)
fulcrum current-task done                     # Mark as DONE
fulcrum current-task cancel                   # Mark as CANCELED
fulcrum current-task pr <github-pr-url>       # Link a GitHub PR
fulcrum current-task linear <linear-url>      # Link a Linear ticket
fulcrum current-task link <url>               # Add link (auto-detects type/label)
fulcrum current-task link <url> --label "Docs" # Add link with custom label
fulcrum current-task link                     # List all links
fulcrum current-task link --remove <url-or-id> # Remove a link
```

### notifications

```bash
fulcrum notify "Title" "Message body"         # Send a notification
fulcrum notifications                         # Check notification settings
fulcrum notifications enable                  # Enable notifications
fulcrum notifications disable                 # Disable notifications
fulcrum notifications test slack              # Test a channel
fulcrum notifications set slack webhookUrl <url> # Configure a channel
```

### config

```bash
fulcrum config list              # List all config values
fulcrum config get <key>         # Get a specific value
fulcrum config set <key> <value> # Set a value
fulcrum config reset <key>       # Reset to default
```

### Server Management

```bash
fulcrum up          # Start Fulcrum server daemon
fulcrum down        # Stop Fulcrum server
fulcrum status      # Check if server is running
fulcrum doctor      # Check all dependencies and versions
```

## fulcrum api — REST API Access

The `fulcrum api` command provides direct access to all Fulcrum REST API endpoints via a resource/action CLI.

### Syntax

```bash
fulcrum api <resource> <action> [<id> ...] [--flag value ...]
```

### Getting the Full Tool Reference

```bash
fulcrum api tools    # Compact reference of all resources, actions, and flags
```

The `tools` output is designed for context window injection (~2,000 tokens for ~130 actions).

### Common Examples

```bash
# Tasks
fulcrum api tasks list --search bug --statuses TO_DO,IN_PROGRESS
fulcrum api tasks create --title "Fix bug" --type worktree
fulcrum api tasks get <id>
fulcrum api tasks move <id> --status DONE
fulcrum api tasks update <id> --priority high --tags "backend,urgent"

# Memory
fulcrum api memory store --content "Learned X" --tags "project,pattern"
fulcrum api memory search --q "deployment"

# Search
fulcrum api search query --q "authentication" --entities tasks,projects

# Backup
fulcrum api backup create --description "Before migration"
fulcrum api backup list

# Calendar
fulcrum api caldav events --from 2026-01-01 --to 2026-01-31
fulcrum api caldav sync
```

### Raw HTTP Mode (Backward Compatible)

```bash
fulcrum api GET /api/tasks
fulcrum api POST /api/tasks -d '{"title":"Fix bug"}'
```

### Route Discovery

```bash
fulcrum api routes                          # List all routes by category
fulcrum api routes --category tasks         # Filter by category
fulcrum api routes --search calendar        # Search routes by keyword
```

## Agent Workflow Patterns

### Typical Task Lifecycle

1. **Task Creation**: User creates a task in Fulcrum UI or CLI
2. **Work Begins**: Agent starts working, task auto-marked IN_PROGRESS via hook
3. **PR Created**: Agent creates PR and links it: `fulcrum current-task pr <url>`
4. **Ready for Review**: Agent marks complete: `fulcrum current-task review`
5. **Notification**: User receives notification that work is ready

### Linking External Resources

```bash
fulcrum current-task pr https://github.com/owner/repo/pull/123
fulcrum current-task linear https://linear.app/team/issue/TEAM-123
fulcrum current-task link https://figma.com/file/abc123/design
fulcrum current-task link https://notion.so/team/spec --label "Product Spec"
```

### Notifying the User

```bash
fulcrum notify "Task Complete" "Implemented the new feature and created PR #123"
fulcrum notify "Need Input" "Which approach should I use for the database migration?"
```

## Global Options

- `--port=<port>` — Server port (default: 7777)
- `--url=<url>` — Override full server URL
- `--json` — Output as JSON for programmatic use

## Task Statuses

- `TO_DO` — Task not yet started
- `IN_PROGRESS` — Task is being worked on
- `IN_REVIEW` — Task is complete and awaiting review
- `DONE` — Task is finished
- `CANCELED` — Task was abandoned

## Best Practices

1. **Use `current-task` inside worktrees** — It auto-detects which task you're in
2. **Link PRs immediately** — Run `fulcrum current-task pr <url>` right after creating a PR
3. **Use `fulcrum api routes --search <keyword>`** to discover endpoints before making calls
4. **Mark review when done** — `fulcrum current-task review` notifies the user
5. **Send notifications for blocking issues** — Keep the user informed of progress
