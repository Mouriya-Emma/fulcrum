# Orchestration Control

Core question: **Can the human maintain situational awareness and intervene across multiple concurrent agents?**

Fulcrum's value proposition is the cockpit — one place to see and control all your agents. If the cockpit fails at 5 concurrent agents, the product fails.

## What to evaluate

### Fleet awareness
When 5 agents are running in parallel:
- Can you tell which are active, which are idle, which errored?
- Can you see at a glance what each agent is working on?
- Does the kanban give you enough info without clicking into each task?
- Is there a way to see "all terminals" or "all diffs" side by side?

### Intervention speed
An agent is doing the wrong thing. How fast can you:
- Find which task/terminal it's in?
- See what it's currently doing?
- Send it a correction (terminal input)?
- Stop it entirely?
- Restart it with a different prompt?

### Agent lifecycle transparency
- Does the task clearly indicate whether an agent is running, idle, or crashed?
- When an agent finishes, does the task status update? Or does it sit in "In Progress" forever?
- If the agent process dies (crash, OOM), does Fulcrum notice?

### Start/stop coherence
- Can you start an agent from WebUI? From CLI? From both?
- Can you stop an agent from WebUI? From CLI?
- If you start from WebUI and stop from CLI, does the UI reflect the change?
- Is "agent running" the same concept everywhere, or does WebUI think the agent is running while CLI says it's stopped?

### Context preservation across tasks
When switching between tasks rapidly:
- Does the terminal tab remember where you were?
- Does the diff tab auto-refresh?
- Can you "cmd+tab" between tasks the way you cmd+tab between windows?

## CLI equivalents

| WebUI action | CLI equivalent | Parity? |
|---|---|---|
| See all tasks + status | `fulcrum tasks` (if exists) | ? |
| See agent terminal output | `fulcrum current-task info` + tmux/dtach attach | ? |
| Send input to agent | Terminal input box | Direct terminal attach | ? |
| Start agent | "Initialize & Open" button | ? |
| Stop agent | ? | ? |
| See task diff | Diff tab | `git diff` in worktree | ? |
