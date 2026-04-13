# Dependency & Coordination

Core question: **Does the dependency system help or hinder? Does the coordination board work for multi-agent scenarios?**

## Task dependencies

Fulcrum supports "blocked by" dependencies between tasks. Task B blocked by Task A means B shouldn't start until A is done.

### Does blocking actually block?

- If Task B is blocked by Task A, can you still start an agent in Task B?
- Should the system prevent it? Or just warn?
- When Task A moves to DONE, does Task B's blocked status update immediately?
- What if Task A is CANCELED — does Task B become unblocked or stuck?

### Dependency graph usability

- With 3 tasks and 2 dependencies: is the graph clear?
- With 10 tasks and 15 dependencies: is the graph still readable?
- Can you create dependencies FROM the graph (drag to connect)? Or only from the detail page?
- Does the graph update in real-time as tasks change status?
- Can you click a node to navigate to the task?

### Circular dependency handling

- What happens if you try to make Task A depend on Task B while Task B already depends on Task A?
- Is it prevented? Is the error message clear?

### Cross-repo dependencies

- Can Task A (in repo X) depend on Task B (in repo Y)?
- Does this make practical sense for the orchestration model?

## Agent coordination board

The board is a filesystem-based message system (`~/.fulcrum/board/messages/`). Agents can post, read, and claim resources.

### Does it work without the server?

The board is designed to work when the Fulcrum server is down. Verify:
- `fulcrum board post "message"` works with server stopped
- `fulcrum board read` works with server stopped
- Messages from one agent are visible to another

### Claim semantics

- `fulcrum board check <resource>` — what constitutes a "resource"? File path? Task ID? Arbitrary string?
- If Agent A claims a resource and crashes, is the claim released? After how long?
- `fulcrum board release-all` — does it only release claims by the current task, or all claims?

### Practical multi-agent scenario

Run two agents on related tasks. Evaluate:
- Can Agent A tell Agent B "I've finished the DB layer, it's in src/db.ts"?
- Can Agent B read that message and act on it?
- Is there a race condition if both agents try to modify the same file through their worktrees?
- After merging Agent A's PR, does Agent B's worktree have the changes? (Pull from main needed?)
