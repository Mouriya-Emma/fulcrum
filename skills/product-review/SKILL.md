---
name: product-review
description: Review Fulcrum's task orchestration logic — not frontend aesthetics, but whether the orchestration model makes sense, whether the human can maintain control over multiple agents, and whether WebUI and CLI provide coherent mental models. Use when evaluating a flow, reviewing a feature, or assessing whether Fulcrum's interaction design matches how people actually orchestrate AI coding agents.
allowed-tools: Bash(moat:*), Bash(*/moat:*), Bash(curl:*), Bash(fulcrum:*), Read, Grep, Glob, Agent
---

# Fulcrum Product Logic Review

Fulcrum is a task orchestration tool for AI coding agents. The core interaction: a human defines work as tasks, each task spawns an isolated agent in a git worktree, and Fulcrum provides oversight of the fleet.

This skill evaluates whether that orchestration model holds up under real use — through WebUI, CLI, and MCP.

## What this skill is NOT

- Not a frontend polish pass (spacing, color, typography)
- Not a code security audit
- Not an accessibility checklist
- Not a generic UX heuristic evaluation

## What this skill IS

An evaluation of whether Fulcrum's orchestration logic is sound:

1. **Does the human stay in control?** — Can you see what every agent is doing? Can you intervene? Can you stop things?
2. **Does the task model match reality?** — Git/Scratch/Manual covers real work? Dependencies block correctly? Status transitions make sense?
3. **Does the terminal-first philosophy hold?** — Agents run in terminals as-is. Does the UI help or get in the way of that?
4. **Do WebUI and CLI tell the same story?** — Same mental model? Same capabilities? Or do they diverge in confusing ways?
5. **Does it scale to many tasks?** — One task is easy. Five concurrent agents with dependencies — does the cockpit still work?

## Review Lenses

Each lens is a perspective to evaluate from. Read the corresponding file in `lenses/` for detailed criteria.

| Lens | File | Core question |
|------|------|---------------|
| Orchestration Control | `lenses/orchestration.md` | Can the human maintain situational awareness and intervene across multiple concurrent agents? |
| Task Lifecycle | `lenses/task-lifecycle.md` | Does the task model (create → execute → review → complete) match how people actually work with AI agents? |
| Terminal & Agent Feel | `lenses/terminal-feel.md` | Does the terminal interaction feel responsive? Can you tell what the agent is doing? Is the boundary between "Fulcrum UI" and "agent running in terminal" clear? |
| WebUI ↔ CLI Coherence | `lenses/webui-cli.md` | Do both interfaces expose the same mental model? Can you switch between them without losing context? |
| Dependency & Coordination | `lenses/dependencies.md` | Does the dependency system help or hinder? Does the coordination board work for multi-agent scenarios? |
| Information Architecture | `lenses/information.md` | At any given moment, can you find what you need? When managing 10+ tasks, does the cockpit still work? |

## How to Review

### 1. Pick a scenario

Don't review "the product." Review a concrete scenario:

- "I have a feature that needs 3 subtasks with dependencies. Create them, run the first agent, review its output, complete it, start the next."
- "An agent is stuck. I need to find which task it's on, see its terminal, intervene, and restart it."
- "I want to check what happened overnight — which tasks completed, which PRs were created, which agents errored."

### 2. Walk through it — both interfaces

Do the scenario in WebUI first. Then do the same scenario via CLI. Note:
- Where did you get stuck?
- Where did you have to think about the tool instead of the task?
- Where did one interface handle it better than the other?
- Where did the mental model break?

For WebUI: use `moat` browser automation to walk through.
For CLI: use `fulcrum` commands directly.

### 3. Evaluate with lenses

After walking through, apply each relevant lens. Not every lens applies to every scenario — pick the ones that matter.

### 4. Report

```markdown
## Review: [scenario description]

### Walkthrough
1. [action] → [what happened] → [what I expected]
2. ...

### Findings

- [BROKEN] Orchestration: After initializing a worktree task, the agent terminal
  shows a shell prompt but the agent never starts. No indication that manual
  intervention is needed. The human loses 5 minutes before realizing nothing
  is happening.
  → Fix: [specific suggestion]

- [FRICTION] CLI: `fulcrum current-task done` works from inside the worktree,
  but there's no `fulcrum tasks done <id>` to mark a task done from outside.
  Have to cd into the worktree first.
  → Fix: [specific suggestion]

- [GAP] WebUI ↔ CLI: WebUI can create PR directly from task detail page.
  CLI has no equivalent — must use `gh pr create` manually. Mental model
  divergence.
  → Fix: [specific suggestion]

- [GOOD] Dependency graph correctly blocks Task 2 when Task 1 is IN_PROGRESS.
  Kanban cards show Blocked/Blocking labels. Graph arrows match the API state.

### Severity summary
| Level | Count |
|-------|-------|
| BROKEN (can't complete the task) | N |
| FRICTION (can complete but painful) | N |
| GAP (missing capability) | N |
| GOOD (works as intended) | N |
```

Severity definitions:
- **BROKEN** — The flow fails. User can't accomplish what they set out to do.
- **FRICTION** — The flow works but requires unnecessary effort, thought, or workaround.
- **GAP** — A capability exists in one interface but not the other, or is missing entirely.
- **GOOD** — Works correctly. Explicitly noting what works prevents re-reviewing and gives credit.
