# Task Lifecycle

Core question: **Does the task model (create → execute → review → complete) match how people actually work with AI agents?**

## The three task types

Fulcrum has Git, Scratch, and Manual tasks. Evaluate whether:

- **Git** — Is the worktree creation smooth? Does branch naming make sense? Is the round-trip (create worktree → agent works → commit → push → PR → merge) friction-free?
- **Scratch** — When do you actually need a non-git isolated directory? Is the distinction clear to a new user?
- **Manual** — A task without an agent or directory. Is it useful as a reminder/tracking mechanism, or does it feel bolted on?

## Status transitions

`TO_DO → IN_PROGRESS → IN_REVIEW → DONE` and `→ CANCELED`

Evaluate:
- Are the transitions initiated by the user, or do they happen automatically? Should they?
- When an agent finishes its work (exits cleanly), should the task auto-move to IN_REVIEW?
- When a PR is merged, should the task auto-move to DONE? (PR monitor exists — does it work?)
- Can you move backward (IN_PROGRESS → TO_DO)? Should you be able to?
- Does CANCELED clean up resources (worktree, terminals, agent processes)?

## Task creation feel

The task title IS the agent prompt. This has consequences:

- Good prompts are long. Does the UI handle 500-character titles gracefully?
- Description supplements the title. Is the separation between "title as prompt" and "description as context" clear?
- AI Mode (Plan vs Default) — is it obvious what each does before you try it?
- "Start work immediately" toggle — what happens if the prerequisites aren't ready (no repo selected)?

## Recurrence

Tasks can recur (daily, weekly, etc.). When a recurring task is marked DONE, a new TO_DO is created.

- Does the recurring task carry over the right context? (Same repo, same description, new branch name?)
- Is it obvious which task is the "current" one vs the completed predecessor?
- Does CANCELED prevent recurrence? (It should, per the docs.)

## CLI lifecycle

| Lifecycle action | WebUI | CLI |
|---|---|---|
| Create task | New Task dialog | ? |
| Set status | Status button on detail page | `fulcrum current-task done/review/cancel` |
| Link PR | Detail page button | `fulcrum current-task pr <url>` |
| Add dependency | Detail page section | ? |
| View task details | `/tasks/$id` page | `fulcrum current-task info` |

For each: is the experience equivalent? Or does one interface force you to switch to the other?
