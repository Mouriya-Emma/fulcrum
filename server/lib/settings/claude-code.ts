import * as fs from 'fs'
import * as path from 'path'
import { log } from '../logger'
import { getHomeDir, assertNotProductionPath } from './paths'

// ==================== Claude Code Settings ====================
// These functions manage ~/.claude/settings.json for configuring Claude Code
// Claude settings always live under $HOME - test isolation overrides HOME itself

// Get Claude settings file path (~/.claude/settings.json)
export function getClaudeSettingsPath(): string {
  const p = path.join(getHomeDir(), '.claude', 'settings.json')
  assertNotProductionPath(p, 'getClaudeSettingsPath')
  return p
}

// Read Claude Code settings
export function getClaudeSettings(): Record<string, unknown> {
  const settingsPath = getClaudeSettingsPath()
  if (!fs.existsSync(settingsPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

// Update Claude Code settings (merges with existing)
export function updateClaudeSettings(updates: Record<string, unknown>): void {
  const settingsPath = getClaudeSettingsPath()
  const dir = path.dirname(settingsPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const current = getClaudeSettings()
  const merged = { ...current, ...updates }
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8')
}

// ==================== Claude Code Config ====================
// These functions manage ~/.claude.json for Claude Code preferences (theme, etc.)
// Claude config always lives under $HOME - test isolation overrides HOME itself

// Get Claude config file path (~/.claude.json)
export function getClaudeConfigPath(): string {
  const p = path.join(getHomeDir(), '.claude.json')
  assertNotProductionPath(p, 'getClaudeConfigPath')
  return p
}

// Read Claude Code config
export function getClaudeConfig(): Record<string, unknown> {
  const configPath = getClaudeConfigPath()
  if (!fs.existsSync(configPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

// Promise-based lock to serialize writes to ~/.claude.json
// Prevents race conditions when multiple tabs trigger concurrent updates
let claudeConfigLock: Promise<void> = Promise.resolve()

// Update Claude Code config (merges with existing)
// Uses promise chaining to ensure sequential writes and prevent corruption
export function updateClaudeConfig(updates: Record<string, unknown>): void {
  claudeConfigLock = claudeConfigLock.then(() => {
    const configPath = getClaudeConfigPath()
    const current = getClaudeConfig()
    const merged = { ...current, ...updates }
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8')
  }).catch((err) => {
    log.settings.error('Failed to update Claude config', { error: String(err) })
  })
}
