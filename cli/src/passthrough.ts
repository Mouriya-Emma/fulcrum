import { spawn, spawnSync } from 'node:child_process'

/**
 * Passthrough unknown CLI commands to MCP tools via mcp2cli.
 *
 * Allows `fulcrum list-tasks --search bug` instead of
 * `uvx mcp2cli --mcp-stdio "fulcrum mcp" list-tasks --search bug`
 */
export async function mcpPassthrough(argv: string[]): Promise<number> {
  // Check uvx availability
  const uvxCheck = spawnSync('which', ['uvx'], { stdio: 'pipe' })
  if (uvxCheck.status !== 0) {
    console.error(
      'Error: uvx is required for MCP tool passthrough but was not found.\n' +
        'Install uv: https://docs.astral.sh/uv/getting-started/installation/'
    )
    return 1
  }

  // Extract --port and --url flags (these go to `fulcrum mcp`, not mcp2cli)
  const mcpFlags: string[] = []
  const passthroughArgs: string[] = []
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === '--port' && i + 1 < argv.length) {
      mcpFlags.push('--port', argv[i + 1])
      i += 2
    } else if (arg.startsWith('--port=')) {
      mcpFlags.push('--port', arg.slice('--port='.length))
      i++
    } else if (arg === '--url' && i + 1 < argv.length) {
      mcpFlags.push('--url', argv[i + 1])
      i += 2
    } else if (arg.startsWith('--url=')) {
      mcpFlags.push('--url', arg.slice('--url='.length))
      i++
    } else if (arg === '--debug') {
      // Skip --debug, it's a global CLI flag not relevant to mcp2cli
      i++
    } else {
      passthroughArgs.push(arg)
      i++
    }
  }

  // Handle --list flag: `fulcrum --list` → list MCP tools
  const listIndex = passthroughArgs.indexOf('--list')
  if (listIndex !== -1) {
    passthroughArgs.splice(listIndex, 1)
    const mcpStdio = buildMcpStdio(mcpFlags)
    const cmd = ['uvx', 'mcp2cli', '--mcp-stdio', mcpStdio, '--list', ...passthroughArgs]
    return runCommand(cmd)
  }

  // The first non-flag arg is the tool name
  const toolIndex = passthroughArgs.findIndex((a) => !a.startsWith('-'))
  if (toolIndex === -1) {
    // No tool name found — nothing to passthrough
    console.error('Error: No tool name provided for MCP passthrough.')
    return 1
  }

  // Convert underscores to dashes in tool name (list_tasks → list-tasks)
  const toolName = passthroughArgs[toolIndex].replace(/_/g, '-')
  const remainingArgs = [...passthroughArgs.slice(0, toolIndex), ...passthroughArgs.slice(toolIndex + 1)]

  const mcpStdio = buildMcpStdio(mcpFlags)
  const cmd = ['uvx', 'mcp2cli', '--mcp-stdio', mcpStdio, toolName, ...remainingArgs]
  return runCommand(cmd)
}

const BUILTIN_COMMANDS: [string, string][] = [
  ['current-task', 'Manage the current worktree task'],
  ['config', 'Manage configuration'],
  ['opencode', 'OpenCode integration'],
  ['claude', 'Claude Code integration'],
  ['board', 'Agent coordination board'],
  ['notifications', 'Manage notification settings'],
  ['notify', 'Send a notification'],
  ['up', 'Start the Fulcrum server'],
  ['down', 'Stop the Fulcrum server'],
  ['status', 'Show server status'],
  ['doctor', 'Check dependencies and system status'],
  ['dev', 'Developer mode commands'],
  ['mcp', 'Start MCP server (stdio)'],
  ['update', 'Check for updates and update Fulcrum'],
  ['migrate-from-vibora', 'Migrate from legacy ~/.vibora directory'],
]

/**
 * Show full help including both built-in commands and MCP tools.
 */
export async function showFullHelp(version: string): Promise<number> {
  console.log(`Fulcrum - Terminal-first AI agent orchestration (v${version})\n`)
  console.log('USAGE fulcrum <command> [OPTIONS]\n')

  // Built-in commands
  console.log('COMMANDS\n')
  const maxLen = Math.max(...BUILTIN_COMMANDS.map(([n]) => n.length))
  for (const [name, desc] of BUILTIN_COMMANDS) {
    console.log(`  ${name.padStart(maxLen)}    ${desc}`)
  }

  // MCP tools
  console.log('\nMCP TOOLS (pass-through)\n')

  const uvxCheck = spawnSync('which', ['uvx'], { stdio: 'pipe' })
  if (uvxCheck.status !== 0) {
    console.log('  (install uv to access MCP tools: https://docs.astral.sh/uv/)')
  } else {
    const proc = spawn('uvx', ['mcp2cli', '--mcp-stdio', 'fulcrum mcp', '--list'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let output = ''
    proc.stdout!.on('data', (data: Buffer) => { output += data.toString() })
    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1))
    })
    if (exitCode === 0 && output.trim()) {
      // Skip the "Available tools:" header line from mcp2cli
      const lines = output.trim().split('\n')
      const toolLines = lines[0]?.match(/^Available/) ? lines.slice(1) : lines
      for (const line of toolLines) {
        if (line.trim()) console.log(line)
      }
    } else {
      console.log('  (unavailable — run fulcrum up first)')
    }
  }

  console.log('\nUse fulcrum <command> --help for more information about a command.')
  return 0
}

function buildMcpStdio(mcpFlags: string[]): string {
  const parts = ['fulcrum', 'mcp', ...mcpFlags]
  return parts.join(' ')
}

async function runCommand(cmd: string[]): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
    })
    proc.on('close', (code) => resolve(code ?? 1))
    proc.on('error', (err) => {
      console.error(`Failed to execute: ${err.message}`)
      resolve(1)
    })
  })
}
