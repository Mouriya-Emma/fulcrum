import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { db, hosts, tasks, terminals } from '../db'
import { eq } from 'drizzle-orm'
import { broadcast } from '../websocket/terminal-ws'
import { getSSHConnectionManager } from '../terminal/ssh-connection-manager'
import type { Host } from '../../../shared/types'

const app = new Hono()

function toApiResponse(row: typeof hosts.$inferSelect): Host {
  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    port: row.port,
    username: row.username,
    authMethod: row.authMethod as 'key' | 'password',
    privateKeyPath: row.privateKeyPath,
    defaultDirectory: row.defaultDirectory,
    fulcrumUrl: row.fulcrumUrl,
    status: row.status as 'unknown' | 'connected' | 'error',
    lastConnectedAt: row.lastConnectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// GET /api/hosts - List all hosts
app.get('/', (c) => {
  const allHosts = db.select().from(hosts).all()
  return c.json(allHosts.map(toApiResponse))
})

// GET /api/hosts/:id - Get single host
app.get('/:id', (c) => {
  const host = db.select().from(hosts).where(eq(hosts.id, c.req.param('id'))).get()
  if (!host) {
    return c.json({ error: 'Host not found' }, 404)
  }
  return c.json(toApiResponse(host))
})

// POST /api/hosts - Create host
app.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    hostname: string
    port?: number
    username: string
    authMethod?: 'key' | 'password'
    privateKeyPath?: string
    password?: string
    defaultDirectory?: string
    fulcrumUrl?: string
  }>()

  if (!body.name || !body.hostname || !body.username) {
    return c.json({ error: 'name, hostname, and username are required' }, 400)
  }

  const now = new Date().toISOString()
  const id = nanoid()

  db.insert(hosts)
    .values({
      id,
      name: body.name,
      hostname: body.hostname,
      port: body.port ?? 22,
      username: body.username,
      authMethod: body.authMethod ?? 'key',
      privateKeyPath: body.privateKeyPath ?? null,
      defaultDirectory: body.defaultDirectory ?? null,
      fulcrumUrl: body.fulcrumUrl ?? null,
      status: 'unknown',
      createdAt: now,
      updatedAt: now,
    })
    .run()

  // TODO: store password via fnox if provided
  // if (body.password && body.authMethod === 'password') {
  //   setFnoxSecret(`FULCRUM_HOST_PWD_${id}`, body.password)
  // }

  broadcast({ type: 'hosts:updated' as never })

  const created = db.select().from(hosts).where(eq(hosts.id, id)).get()!
  return c.json(toApiResponse(created), 201)
})

// PATCH /api/hosts/:id - Update host
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(hosts).where(eq(hosts.id, id)).get()
  if (!existing) {
    return c.json({ error: 'Host not found' }, 404)
  }

  const body = await c.req.json<Partial<{
    name: string
    hostname: string
    port: number
    username: string
    authMethod: 'key' | 'password'
    privateKeyPath: string | null
    defaultDirectory: string | null
    fulcrumUrl: string | null
  }>>()

  const now = new Date().toISOString()
  db.update(hosts)
    .set({ ...body, updatedAt: now })
    .where(eq(hosts.id, id))
    .run()

  broadcast({ type: 'hosts:updated' as never })

  const updated = db.select().from(hosts).where(eq(hosts.id, id)).get()!
  return c.json(toApiResponse(updated))
})

// DELETE /api/hosts/:id - Delete host
app.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(hosts).where(eq(hosts.id, id)).get()
  if (!existing) {
    return c.json({ error: 'Host not found' }, 404)
  }

  // Clear hostId from associated tasks
  const now = new Date().toISOString()
  db.update(tasks)
    .set({ hostId: null, updatedAt: now })
    .where(eq(tasks.hostId, id))
    .run()

  // Clear hostId from associated terminals
  db.update(terminals)
    .set({ hostId: null, updatedAt: now })
    .where(eq(terminals.hostId, id))
    .run()

  db.delete(hosts).where(eq(hosts.id, id)).run()

  broadcast({ type: 'hosts:updated' as never })

  return c.json({ success: true })
})

// POST /api/hosts/:id/test - Test SSH connection
app.post('/:id/test', async (c) => {
  const id = c.req.param('id')
  const host = db.select().from(hosts).where(eq(hosts.id, id)).get()
  if (!host) {
    return c.json({ error: 'Host not found' }, 404)
  }

  const manager = getSSHConnectionManager()
  const result = await manager.testConnection({
    host: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: host.authMethod as 'key' | 'password',
    privateKeyPath: host.privateKeyPath ?? undefined,
  })

  const now = new Date().toISOString()
  db.update(hosts)
    .set({
      status: result.success ? 'connected' : 'error',
      lastConnectedAt: result.success ? now : host.lastConnectedAt,
      updatedAt: now,
    })
    .where(eq(hosts.id, id))
    .run()

  return c.json(result)
})

// POST /api/hosts/:id/check-env - Check remote environment readiness
app.post('/:id/check-env', async (c) => {
  const id = c.req.param('id')
  const host = db.select().from(hosts).where(eq(hosts.id, id)).get()
  if (!host) {
    return c.json({ error: 'Host not found' }, 404)
  }

  const manager = getSSHConnectionManager()
  const sshConfig = {
    host: host.hostname,
    port: host.port,
    username: host.username,
    authMethod: host.authMethod as 'key' | 'password',
    privateKeyPath: host.privateKeyPath ?? undefined,
  }

  // Check each tool's availability via SSH
  const checks: Record<string, { installed: boolean; version?: string; error?: string }> = {}

  const toolChecks = [
    { name: 'dtach', cmd: 'dtach --version 2>&1 | head -1' },
    { name: 'fulcrum', cmd: 'fulcrum --version 2>&1 | head -1' },
    { name: 'claude', cmd: 'claude --version 2>&1 | head -1' },
    { name: 'opencode', cmd: 'opencode version 2>&1 | head -1' },
  ]

  for (const tool of toolChecks) {
    try {
      const output = await manager.execCommand(sshConfig, `which ${tool.name} >/dev/null 2>&1 && ${tool.cmd}`)
      checks[tool.name] = { installed: true, version: output.trim() }
    } catch {
      checks[tool.name] = { installed: false }
    }
  }

  // Check if default directory exists / is writable
  if (host.defaultDirectory) {
    try {
      await manager.execCommand(sshConfig, `test -d '${host.defaultDirectory}' && test -w '${host.defaultDirectory}'`)
      checks['directory'] = { installed: true }
    } catch {
      checks['directory'] = { installed: false, error: `${host.defaultDirectory} not found or not writable` }
    }
  }

  const ready = checks['dtach']?.installed && checks['fulcrum']?.installed &&
    (checks['claude']?.installed || checks['opencode']?.installed)

  return c.json({ checks, ready })
})

export default app
