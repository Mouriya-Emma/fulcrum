# WebUI ↔ CLI Coherence

Core question: **Do both interfaces expose the same mental model? Can you switch between them without losing context?**

Fulcrum has three interfaces: WebUI (React SPA), CLI (`fulcrum` command), and MCP (tool access for agents). They must tell the same story about the same state.

## Mental model alignment

The user's mental model should be:
- "I have N tasks, each with a status, an agent, and a worktree"
- "I can see and control them from the web, the terminal, or through MCP"

Evaluate whether each interface reinforces or contradicts this model.

## Capability matrix

Walk through every action and check which interfaces support it:

| Action | WebUI | CLI | MCP | Notes |
|--------|-------|-----|-----|-------|
| List all tasks | Kanban page | `fulcrum tasks` ? | `board_read` ? | |
| Create task | New Task dialog | ? | ? | |
| View task detail | `/tasks/$id` | `fulcrum current-task info` | ? | |
| Change status | Status button | `fulcrum current-task done/review/cancel` | ? | |
| Initialize worktree | "Initialize" button | ? | ? | |
| See agent terminal | Terminal tab | dtach attach? | ? | |
| Send input to agent | Terminal input box | dtach? | ? | |
| View diff | Diff tab | `git diff` in worktree | ? | |
| View files | Files tab | `ls` in worktree | ? | |
| Commit | Commit button | `git commit` in worktree | ? | |
| Push | Push button | `git push` in worktree | ? | |
| Create PR | Create PR button | `gh pr create`? | ? | |
| Link PR | Detail page | `fulcrum current-task pr <url>` | ? | |
| Add dependency | Detail page | ? | ? | |
| See dependency graph | Graph view | ? | ? | |
| Agent coordination | ? | `fulcrum board post/read/check` | `board_*` tools | |
| Start/stop server | N/A | `fulcrum up/down/status` | N/A | |
| Health check | Monitoring page | `fulcrum doctor` | ? | |
| Notifications | Settings page | `fulcrum notifications` | ? | |
| Search | Search bar | ? | ? | |

For each `?`: is it a real gap, or just undocumented?

## Context switching

Scenario: user is in the WebUI viewing a task, then switches to CLI to do git operations in the worktree, then comes back to WebUI.

- Does the WebUI pick up changes made via CLI (git commit, status change)?
- Does `fulcrum current-task info` reflect changes made in WebUI?
- Is there a delay? Does real-time sync work across interfaces?

## CLI ergonomics

The CLI is used from INSIDE a worktree (cd into the worktree, then `fulcrum current-task ...`). Evaluate:

- Is it intuitive that the CLI is context-aware (knows which task based on cwd)?
- What if you're not in a worktree? Is the error message helpful?
- Can you operate on a specific task by ID from anywhere? Or must you be in the worktree?
- Is the output format useful? (JSON flag? Human-readable default? Piping to jq?)

## MCP as third interface

Agents themselves can use MCP tools (board, memory, etc.). Evaluate:

- Are MCP tool names consistent with CLI command names?
- Can an agent discover its own task context through MCP?
- Is there a coherent story for "agent self-reports status" → "human sees it in WebUI"?
