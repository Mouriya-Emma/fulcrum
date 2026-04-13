# Terminal & Agent Feel

Core question: **Does the terminal interaction feel responsive? Is the boundary between "Fulcrum UI" and "agent running in terminal" clear?**

Fulcrum's philosophy is terminal-first — agents run in terminals as-is, no wrapper API, no abstraction. The product adds oversight, not interference. This lens evaluates whether that philosophy holds in practice.

## Terminal responsiveness

- Input latency: type a character in the terminal input box. Is there perceptible delay before it appears in the terminal?
- Output rendering: when the agent is producing rapid output (writing a file, running tests), does xterm keep up? Any visual glitching, missed frames, or scroll issues?
- Resize: resize the browser window. Does the terminal resize correctly? Does dtach handle the SIGWINCH?
- Long output: agent generates 1000 lines of output. Can you scroll back? Is scroll performance acceptable?

## Agent terminal vs shell terminal

Each task gets two terminals: agent terminal (Claude runs here) and shell terminal (user's shell). Evaluate:

- Is it immediately obvious which terminal you're looking at?
- Can you switch between them without confusion?
- When the agent terminal is active, can you still access the shell? Or do you have to wait?
- If the agent is waiting for permission (non-bypass mode), is the permission prompt visible and actionable?

## Terminal input box (top of task detail)

There's a text input above the terminal area. Evaluate:

- What does this input do? Is it for sending commands to the agent? To the shell? To both?
- Is it clear which terminal receives the input?
- Can you send multi-line input?
- Is there history (up arrow for previous commands)?
- How does this relate to typing directly in the xterm?

## Agent startup

When a task is initialized:

- Does the agent actually start? Reliably? Every time?
- How long does it take from "Initialize & Open" to seeing the agent's first output?
- If the agent fails to start, what does the user see?
- Can you restart the agent without re-creating the entire task?

## Agent completion

When the agent finishes its work:

- Does the terminal show a clear "done" state?
- Does the task status change?
- Is the agent's exit code visible anywhere?
- Can you review what the agent did (terminal scrollback, diff, git log) after it exits?

## CLI terminal interaction

From the CLI side:

- `fulcrum current-task info` — does it show enough about the running agent?
- Can you attach to the agent's terminal from the CLI? (dtach -a)
- Can you see the agent's output without attaching (tail the log)?
- MCP tools (`board_read`, `board_post`) — do they work for agent-to-agent coordination?
