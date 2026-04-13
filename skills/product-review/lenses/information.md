# Information Architecture

Core question: **At any given moment, can you find what you need? When managing 10+ tasks, does the cockpit still work?**

This is not about whether the layout is pretty. It's about whether the right information is available at the right time when orchestrating multiple agents.

## The cockpit at scale

With 1-2 tasks, everything is easy. The real test is at 10+ concurrent tasks across 3+ repos.

### Kanban scaling
- With 15 tasks in IN_PROGRESS, can you quickly find the one you care about?
- Do filters (project, tags, priority, type) actually narrow down effectively?
- Is search fast enough for task titles that are full prompts (500+ chars)?
- Does the kanban show enough metadata on each card to triage without clicking in?

### Information density tradeoff
The task card shows: title, description, tags, dependency status, repo name, time estimate, type badge. 

- Is this the right set? Missing anything critical (e.g., "agent running" indicator)?
- Is anything unnecessary for triage? (e.g., full description visible when you have 20 cards)
- When task titles are agent prompts, the card is huge. Does truncation work? Is there a compact mode?

## What you need at each stage

### Planning (creating tasks and setting dependencies)
- Can you see all tasks in a project at once?
- Can you set up a dependency chain without leaving the kanban?
- Is the dependency graph usable for planning, or only for viewing?

### Executing (agents are running)
- Which agents are active right now? Is there a dashboard/view for this?
- Can you see a summary of progress without clicking into each task?
- Monitoring page — does it show agent-specific metrics? Or just system CPU/memory?

### Reviewing (agents finished, need to check work)
- Can you quickly see which tasks have uncommitted changes?
- Is the diff view useful for reviewing agent output? (File grouping, syntax highlighting, context)
- Can you compare "what I asked for" (task title) with "what was done" (diff) in the same view?

### Retrospective (what happened over time)
- Can you see a timeline of task completions?
- Which tasks created PRs? Were they merged?
- How much time was spent? (Estimated vs actual — is actual tracked?)

## Calendar as orchestration tool

The calendar shows tasks by due date. Evaluate:
- Is the calendar useful for planning sprints of agent work?
- Can you drag tasks to reschedule?
- Does the weekly view show enough density for daily agent orchestration?
- Can you create tasks directly from the calendar?

## Search as escape hatch

When you can't find something through navigation:
- Does search cover task titles, descriptions, tags?
- Does search cover terminal output or agent logs?
- Can you search across repos?
- Are results ranked by relevance or just chronological?
