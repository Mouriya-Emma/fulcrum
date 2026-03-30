---
name: fulcrum
description: AI orchestration and task management platform. Use this skill when working in a Fulcrum task worktree, managing tasks/projects, querying task lists (overdue, by status, by tag), checking task details, or interacting with the Fulcrum server. Triggers: "fulcrum tasks", "list tasks", "overdue tasks", "task status", "my tasks", "what tasks".
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

## Agent Coordination Board

When multiple agents work on the same project in separate worktrees, use the coordination board to avoid conflicts (port collisions, concurrent migrations, etc.).

### When to Use

- **Before starting a dev server** — check if the port is already claimed
- **Before running database migrations** — check if another agent is migrating
- **When using shared resources** — claim them first, release when done

### CLI Commands

```bash
fulcrum board                              # Read recent messages (last 1h)
fulcrum board read --since 2h              # Custom time window
fulcrum board read --type claim            # Filter by type
fulcrum board read --tag port:5173         # Filter by tag

fulcrum board post "Using port 5173" --type claim --tag port:5173
fulcrum board post "Migration complete" --type info

fulcrum board check port:5173              # Check if resource is claimed

fulcrum board release-all                  # Release all your claims (auto-runs on Stop)

fulcrum board clean                        # Remove expired messages
fulcrum board clean --all                  # Remove ALL messages
```

### Best Practices

1. **Always check before claiming** — `fulcrum board check port:<N>` before starting a dev server
2. **Always release when done** — Post a `release` message or use `fulcrum board release-all`
3. **Claims auto-expire** — TTL is 2 hours for claims, so crashes won't permanently block resources
4. **The Stop hook auto-releases** — When your session ends, claims are released automatically

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
3. **Mark review when done** — `fulcrum current-task review` notifies the user
4. **Send notifications for blocking issues** — Keep the user informed of progress
