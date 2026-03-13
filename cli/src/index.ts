#!/usr/bin/env bun

import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'

// Import command definitions
import { currentTaskCommand } from './commands/current-task'
import { configCommand } from './commands/config'
import { opencodeCommand } from './commands/opencode'
import { claudeCommand } from './commands/claude'
import { notificationsCommand } from './commands/notifications'
import { notifyCommand } from './commands/notify'
import { upCommand } from './commands/up'
import { downCommand } from './commands/down'
import { statusCommand } from './commands/status'
import { doctorCommand } from './commands/doctor'
import { devCommand } from './commands/dev'
import { mcpCommand } from './commands/mcp'

import { boardCommand } from './commands/board'
import { migrateFromViboraCommand } from './commands/migrate-from-vibora'
import { updateCommand } from './commands/update'

import { mcpPassthrough, showFullHelp } from './passthrough'

import pkg from '../../package.json'

const VERSION = pkg.version

// Known built-in subcommands — anything else gets passed through to MCP
const KNOWN_COMMANDS = new Set([
  'current-task', 'config', 'opencode', 'claude', 'board',
  'notifications', 'notify', 'up', 'down', 'status', 'doctor',
  'dev', 'mcp', 'update', 'migrate-from-vibora',
])

// Suppress stack traces unless --debug is passed
// citty's runMain logs errors twice: once with full Error object, once with just message
// We filter out the Error object log to avoid duplicate messages and hide stack traces
if (!process.argv.includes('--debug')) {
  const defaultReporter = consola.options.reporters[0]
  consola.options.reporters = [
    {
      log: (logObj, ctx) => {
        // Skip Error objects - citty logs the message separately
        if (logObj.args[0] instanceof Error) {
          return
        }
        defaultReporter?.log?.(logObj, ctx)
      },
    },
  ]
}

// ============================================================================
// Main CLI
// ============================================================================

const main = defineCommand({
  meta: {
    name: 'fulcrum',
    version: VERSION,
    description: 'Fulcrum - Terminal-first AI agent orchestration',
  },
  subCommands: {
    // Context-aware task operations (for working in a task worktree)
    'current-task': currentTaskCommand,

    // Configuration
    config: configCommand,

    // Agent integrations
    opencode: opencodeCommand,
    claude: claudeCommand,

    // Agent coordination
    board: boardCommand,

    // Notifications
    notifications: notificationsCommand,
    notify: notifyCommand,

    // Server management
    up: upCommand,
    down: downCommand,
    status: statusCommand,
    doctor: doctorCommand,
    dev: devCommand,
    mcp: mcpCommand,
    update: updateCommand,

    // Migration
    'migrate-from-vibora': migrateFromViboraCommand,
  },
})

// Check if the command should be passed through to MCP tools
const commandArg = process.argv.slice(2).find((a) => !a.startsWith('-'))
const hasListFlag = process.argv.includes('--list')
const hasHelpFlag = process.argv.includes('--help') || process.argv.includes('-h')

if (hasHelpFlag && !commandArg) {
  // `fulcrum --help` → show built-in commands + MCP tools
  showFullHelp(VERSION).then((code) => process.exit(code))
} else if (hasListFlag && !commandArg) {
  // `fulcrum --list` → list MCP tools only
  mcpPassthrough(process.argv.slice(2)).then((code) => process.exit(code))
} else if (commandArg && !KNOWN_COMMANDS.has(commandArg)) {
  // Unknown command → MCP tool passthrough
  mcpPassthrough(process.argv.slice(2)).then((code) => process.exit(code))
} else {
  runMain(main)
}
