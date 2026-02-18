import { defineCommand } from 'citty'
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverServerUrl } from '../utils/server'
import { output, isJsonOutput } from '../utils/output'
import { CliError, ExitCodes } from '../utils/errors'
import { globalArgs, toFlags, setupJsonOutput } from './shared'
import { parseOpenAPISpec, parseOpenAPIActions, type ApiRouteCategory, type ApiResource, type ApiAction } from '../openapi-parser'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const SPEC_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ============================================================================
// Spec fetching with caching
// ============================================================================

function getSpecCachePath(baseUrl: string): string {
  // Extract port from URL for cache key
  const port = new URL(baseUrl).port || '7777'
  return join(tmpdir(), `fulcrum-openapi-${port}.json`)
}

async function fetchSpec(baseUrl: string): Promise<Record<string, unknown>> {
  const cachePath = getSpecCachePath(baseUrl)

  // Check cache
  if (existsSync(cachePath)) {
    const stat = statSync(cachePath)
    const age = Date.now() - stat.mtimeMs
    if (age < SPEC_CACHE_TTL_MS) {
      try {
        return JSON.parse(readFileSync(cachePath, 'utf-8'))
      } catch {
        // Cache corrupt, re-fetch
      }
    }
  }

  // Fetch from server
  let res: Response
  try {
    res = await fetch(`${baseUrl}/openapi.json`)
  } catch {
    throw new CliError(
      'SERVER_UNREACHABLE',
      `Server unreachable at ${baseUrl} — requires a running server`,
      ExitCodes.SERVER_UNREACHABLE
    )
  }

  if (!res.ok) {
    throw new CliError(
      'SPEC_ERROR',
      `Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`,
      ExitCodes.ERROR
    )
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new CliError(
      'SPEC_ERROR',
      `Server returned ${contentType || 'unknown content type'} instead of JSON — is the server up to date?`,
      ExitCodes.ERROR
    )
  }

  const spec = await res.json()

  // Write cache
  try {
    writeFileSync(cachePath, JSON.stringify(spec))
  } catch {
    // Cache write failure is non-fatal
  }

  return spec
}

async function fetchRoutes(baseUrl: string): Promise<ApiRouteCategory[]> {
  const spec = await fetchSpec(baseUrl)
  return parseOpenAPISpec(spec as Parameters<typeof parseOpenAPISpec>[0])
}

async function fetchResources(baseUrl: string): Promise<ApiResource[]> {
  const spec = await fetchSpec(baseUrl)
  return parseOpenAPIActions(spec as Parameters<typeof parseOpenAPIActions>[0])
}

// ============================================================================
// Existing handlers (backward compat)
// ============================================================================

async function handleRoutes(flags: Record<string, string>) {
  const category = flags.category?.toLowerCase()
  const search = flags.search?.toLowerCase()

  const baseUrl = discoverServerUrl(flags.url, flags.port)
  const apiRoutes = await fetchRoutes(baseUrl)

  let filtered = apiRoutes

  if (category) {
    filtered = filtered.filter((c) => c.category === category)
    if (filtered.length === 0) {
      const categories = apiRoutes.map((c) => c.category).join(', ')
      throw new CliError('UNKNOWN_CATEGORY', `Unknown category: ${category}. Available: ${categories}`, ExitCodes.INVALID_ARGS)
    }
  }

  if (search) {
    filtered = filtered
      .map((cat) => ({
        ...cat,
        routes: cat.routes.filter(
          (r) =>
            r.path.toLowerCase().includes(search) ||
            r.description.toLowerCase().includes(search) ||
            r.method.toLowerCase().includes(search)
        ),
      }))
      .filter((cat) => cat.routes.length > 0)
  }

  if (isJsonOutput()) {
    output(filtered)
    return
  }

  if (filtered.length === 0) {
    console.log('No routes match your search.')
    return
  }

  for (const cat of filtered) {
    console.log(`\n${cat.category} — ${cat.description}`)
    console.log('─'.repeat(60))
    for (const route of cat.routes) {
      const method = route.method.padEnd(6)
      console.log(`  ${method} ${route.path}`)
      console.log(`         ${route.description}`)
      if (route.queryParams) {
        console.log(`         Query: ${route.queryParams}`)
      }
      if (route.bodyFields) {
        console.log(`         Body:  ${route.bodyFields}`)
      }
    }
  }
  console.log('')
}

async function handleHttpRequest(method: string, pathAndQuery: string, data: string | undefined, flags: Record<string, string>) {
  const upperMethod = method.toUpperCase()
  if (!HTTP_METHODS.includes(upperMethod as (typeof HTTP_METHODS)[number])) {
    throw new CliError('INVALID_METHOD', `Invalid HTTP method: ${method}. Valid: ${HTTP_METHODS.join(', ')}`, ExitCodes.INVALID_ARGS)
  }

  if (!pathAndQuery) {
    throw new CliError('MISSING_PATH', 'API path is required. Example: fulcrum api GET /api/tasks', ExitCodes.INVALID_ARGS)
  }

  // Ensure path starts with /
  const normalizedPath = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`

  const baseUrl = discoverServerUrl(flags.url, flags.port)
  const url = `${baseUrl}${normalizedPath}`

  const fetchOptions: RequestInit = {
    method: upperMethod,
    headers: { 'Content-Type': 'application/json' },
  }

  if (data && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod)) {
    fetchOptions.body = data
  }

  let res: Response
  try {
    res = await fetch(url, fetchOptions)
  } catch {
    throw new CliError('SERVER_UNREACHABLE', `Server unreachable: ${baseUrl}`, ExitCodes.SERVER_UNREACHABLE)
  }

  let body: unknown
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await res.json()
  } else {
    body = await res.text()
  }

  if (!res.ok) {
    if (isJsonOutput()) {
      console.log(JSON.stringify({ success: false, status: res.status, error: body }))
    } else {
      console.error(`Error ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body, null, 2)}`)
    }
    process.exit(ExitCodes.ERROR)
  }

  if (isJsonOutput()) {
    output(body)
  } else {
    console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  }
}

// ============================================================================
// Resource/Action dispatch
// ============================================================================

function resolveAction(resources: ApiResource[], resourceName: string, actionName?: string): { resource: ApiResource; action?: ApiAction } {
  const resource = resources.find((r) => r.name === resourceName)
  if (!resource) {
    const available = resources.map((r) => r.name).join(', ')
    throw new CliError('UNKNOWN_RESOURCE', `Unknown resource: ${resourceName}. Available: ${available}`, ExitCodes.INVALID_ARGS)
  }

  if (!actionName) {
    return { resource }
  }

  const action = resource.actions.find((a) => a.action === actionName)
  if (!action) {
    const available = resource.actions.map((a) => a.action).join(', ')
    throw new CliError('UNKNOWN_ACTION', `Unknown action: ${actionName} for ${resourceName}. Available: ${available}`, ExitCodes.INVALID_ARGS)
  }

  return { resource, action }
}

/**
 * Auto-coerce string values to appropriate types:
 * "true"/"false" → boolean, numeric strings → number, comma-separated → array
 */
function coerceValue(value: string, isArrayField: boolean): unknown {
  if (isArrayField || value.includes(',')) {
    return value.split(',').map((v) => v.trim())
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value !== '' && !isNaN(Number(value)) && isFinite(Number(value))) {
    return Number(value)
  }
  return value
}

function buildRequest(
  action: ApiAction,
  positionalArgs: string[],
  flags: Record<string, string>
): { method: string; url: string; body?: string } {
  // Map positional args to path parameters
  let path = action.path
  for (let i = 0; i < action.pathParams.length; i++) {
    const param = action.pathParams[i]
    const value = positionalArgs[i]
    if (!value) {
      throw new CliError('MISSING_PATH_PARAM', `Missing required path parameter: <${param}>`, ExitCodes.INVALID_ARGS)
    }
    path = path.replace(`{${param}}`, encodeURIComponent(value))
  }

  // Check for raw JSON override via --data / -d
  if (flags.data || flags.d) {
    const body = flags.data || flags.d
    return { method: action.method, url: path, body }
  }

  // Known array body fields for smarter coercion
  const arrayBodyFields = new Set<string>()
  for (const f of action.bodyFields) {
    // Fields that are commonly arrays (heuristic: plural names or known patterns)
    if (['ids', 'tags', 'repositories', 'services', 'uids'].includes(f.name)) {
      arrayBodyFields.add(f.name)
    }
  }

  if (action.method === 'GET' || action.method === 'HEAD') {
    // Map flags to query parameters
    const queryParts: string[] = []
    for (const [key, value] of Object.entries(flags)) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
    return { method: action.method, url: `${path}${queryString}` }
  }

  // POST/PATCH/PUT/DELETE: map flags to JSON body
  if (Object.keys(flags).length > 0) {
    const body: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(flags)) {
      body[key] = coerceValue(value, arrayBodyFields.has(key))
    }
    return { method: action.method, url: path, body: JSON.stringify(body) }
  }

  return { method: action.method, url: path }
}

/**
 * Parse raw process.argv to extract flags that citty doesn't know about.
 * Returns: { positionalArgs, actionFlags, globalFlags }
 */
function parseRawArgs(rawArgs: string[]): {
  positionalArgs: string[]
  actionFlags: Record<string, string>
  globalFlags: Record<string, string>
} {
  const positionalArgs: string[] = []
  const actionFlags: Record<string, string> = {}
  const globalFlags: Record<string, string> = {}
  const globalFlagNames = new Set(['port', 'url', 'json', 'debug', 'data', 'd'])

  let i = 0
  while (i < rawArgs.length) {
    const arg = rawArgs[i]
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      let key: string
      let value: string
      if (eqIdx !== -1) {
        key = arg.slice(2, eqIdx)
        value = arg.slice(eqIdx + 1)
      } else {
        key = arg.slice(2)
        // Peek at next arg: if it's not a flag, treat it as the value
        const next = rawArgs[i + 1]
        if (next && !next.startsWith('-')) {
          value = next
          i++
        } else {
          value = 'true'
        }
      }
      if (globalFlagNames.has(key)) {
        globalFlags[key] = value
      } else {
        actionFlags[key] = value
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag like -d
      const key = arg.slice(1)
      const next = rawArgs[i + 1]
      if (next && !next.startsWith('-')) {
        if (globalFlagNames.has(key)) {
          globalFlags[key] = next
        } else {
          actionFlags[key] = next
        }
        i++
      } else {
        if (globalFlagNames.has(key)) {
          globalFlags[key] = 'true'
        } else {
          actionFlags[key] = 'true'
        }
      }
    } else {
      positionalArgs.push(arg)
    }
    i++
  }

  return { positionalArgs, actionFlags, globalFlags }
}

async function handleResourceAction(rawArgs: string[], globalFlagsFromCitty: Record<string, string>) {
  const { positionalArgs, actionFlags, globalFlags } = parseRawArgs(rawArgs)

  // Merge global flags (citty-parsed take precedence over raw-parsed)
  const mergedGlobalFlags = { ...globalFlags, ...globalFlagsFromCitty }

  const baseUrl = discoverServerUrl(mergedGlobalFlags.url, mergedGlobalFlags.port)
  const resources = await fetchResources(baseUrl)

  const resourceName = positionalArgs[0]
  const actionName = positionalArgs[1]
  const extraPositionals = positionalArgs.slice(2)

  if (!resourceName) {
    // List all resources
    if (isJsonOutput()) {
      output(resources.map((r) => ({ name: r.name, description: r.description, actions: r.actions.length })))
      return
    }
    console.log('\nFulcrum API Resources')
    console.log('─'.repeat(40))
    for (const r of resources) {
      console.log(`  ${r.name.padEnd(16)} ${r.description} (${r.actions.length} actions)`)
    }
    console.log(`\nUse: fulcrum api <resource> to list actions`)
    console.log(`     fulcrum api <resource> <action> [<id>] [--flag value]`)
    console.log('')
    return
  }

  const resolved = resolveAction(resources, resourceName, actionName)

  if (!resolved.action) {
    // List actions for this resource
    if (isJsonOutput()) {
      output(resolved.resource)
      return
    }
    console.log(`\n${resolved.resource.name} — ${resolved.resource.description}`)
    console.log('─'.repeat(60))
    for (const a of resolved.resource.actions) {
      const params = a.pathParams.map((p) => `<${p}>`).join(' ')
      const flags = [
        ...a.queryParams.map((p) => `--${p}`),
        ...a.bodyFields.map((f) => (f.required ? `--${f.name}` : `[--${f.name}]`)),
      ].join(' ')
      console.log(`  ${a.action} ${params} ${flags}`.trimEnd())
      console.log(`    ${a.description}`)
    }
    console.log('')
    return
  }

  // Execute the action
  const req = buildRequest(resolved.action, extraPositionals, actionFlags)

  // Use the same HTTP request handler
  await handleHttpRequest(req.method, req.url, req.body, mergedGlobalFlags)
}

// ============================================================================
// Compact tools reference
// ============================================================================

function formatToolsReference(resources: ApiResource[]): string {
  const lines: string[] = []
  lines.push('Fulcrum API — fulcrum api <resource> <action> [<id>] [--key value]')
  lines.push('')

  for (const r of resources) {
    lines.push(`${r.name} — ${r.description}`)
    for (const a of r.actions) {
      const parts: string[] = [`  ${a.action}`]

      // Path params as <param>
      for (const p of a.pathParams) {
        parts.push(`<${p}>`)
      }

      // Flags: required body fields first, then optional query/body
      const requiredFlags = a.bodyFields.filter((f) => f.required).map((f) => `--${f.name}`)
      const optionalFlags = [
        ...a.queryParams.map((p) => `--${p}`),
        ...a.bodyFields.filter((f) => !f.required).map((f) => `--${f.name}`),
      ]

      if (requiredFlags.length > 0) {
        parts.push(requiredFlags.join(' '))
      }
      if (optionalFlags.length > 0) {
        parts.push(`[${optionalFlags.join(' ')}]`)
      }

      // Special marker for multipart
      if (a.description.toLowerCase().includes('multipart')) {
        parts.push('(multipart)')
      }

      lines.push(parts.join(' '))
    }
  }

  return lines.join('\n')
}

async function handleTools(flags: Record<string, string>) {
  const baseUrl = discoverServerUrl(flags.url, flags.port)
  const resources = await fetchResources(baseUrl)

  if (isJsonOutput()) {
    output(resources)
    return
  }

  console.log(formatToolsReference(resources))
}

// ============================================================================
// Detect whether first positional arg is a resource or an HTTP method
// ============================================================================

function isHttpMethod(arg: string): boolean {
  return HTTP_METHODS.includes(arg.toUpperCase() as (typeof HTTP_METHODS)[number])
}

/**
 * Extract the raw args after "fulcrum api" from process.argv.
 * Skips: node binary, script path, "api" subcommand.
 */
function getRawArgsAfterApi(): string[] {
  const argv = process.argv
  // Find "api" in argv and return everything after it
  const apiIdx = argv.indexOf('api')
  if (apiIdx === -1) return []
  return argv.slice(apiIdx + 1)
}

// ============================================================================
// Command Definitions
// ============================================================================

const routesCommand = defineCommand({
  meta: { name: 'routes', description: 'List available API routes' },
  args: {
    ...globalArgs,
    category: { type: 'string' as const, description: 'Filter by category' },
    search: { type: 'string' as const, description: 'Search routes by keyword' },
  },
  async run({ args }) {
    setupJsonOutput(args)
    await handleRoutes(toFlags(args))
  },
})

const toolsCommand = defineCommand({
  meta: { name: 'tools', description: 'Print compact tool reference for context window injection' },
  args: {
    ...globalArgs,
  },
  async run({ args }) {
    setupJsonOutput(args)
    await handleTools(toFlags(args))
  },
})

export const apiCommand = defineCommand({
  meta: { name: 'api', description: 'REST API access — route discovery, HTTP proxy, and resource/action CLI' },
  args: {
    ...globalArgs,
    method: { type: 'positional' as const, description: 'HTTP method, resource name, or "routes"/"tools"', required: false },
    path: { type: 'positional' as const, description: 'API path or action name', required: false },
    data: { type: 'string' as const, alias: 'd', description: 'Request body (JSON)' },
    category: { type: 'string' as const, description: 'Filter routes by category' },
    search: { type: 'string' as const, description: 'Search routes by keyword' },
  },
  subCommands: {
    routes: routesCommand,
    tools: toolsCommand,
  },
  async run({ args }) {
    setupJsonOutput(args)
    const flags = toFlags(args)
    const firstArg = args.method as string | undefined

    // No args → list resources
    if (!firstArg) {
      await handleResourceAction([], flags)
      return
    }

    // Legacy: "routes" keyword
    if (firstArg.toLowerCase() === 'routes') {
      await handleRoutes(flags)
      return
    }

    // Legacy: "tools" keyword
    if (firstArg.toLowerCase() === 'tools') {
      await handleTools(flags)
      return
    }

    // HTTP method → raw HTTP proxy mode
    if (isHttpMethod(firstArg)) {
      await handleHttpRequest(firstArg, args.path as string, args.data as string | undefined, flags)
      return
    }

    // Resource/action mode — re-parse from raw argv since citty
    // doesn't handle unknown flags
    const rawArgs = getRawArgsAfterApi()
    await handleResourceAction(rawArgs, flags)
  },
})
