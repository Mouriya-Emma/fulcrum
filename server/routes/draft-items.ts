import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, draftItems, tasks, taskRelationships, repositories } from '../db'
import { broadcast } from '../websocket/terminal-ws'
import { parseGitHubRemoteUrl } from '../services/github'
import { getSetting } from '../lib/settings'

const app = new Hono()

// GET /api/draft-items/:taskId - List all draft items for a task
app.get('/:taskId', (c) => {
  const taskId = c.req.param('taskId')

  const items = db
    .select()
    .from(draftItems)
    .where(eq(draftItems.taskId, taskId))
    .orderBy(asc(draftItems.position))
    .all()

  return c.json(items)
})

// POST /api/draft-items/:taskId - Create a new draft item
app.post('/:taskId', async (c) => {
  const taskId = c.req.param('taskId')
  const body = await c.req.json<{ title: string; position?: number }>()

  if (!body.title?.trim()) {
    return c.json({ error: 'Title is required' }, 400)
  }

  // Verify task exists
  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  // Auto-assign position if not provided
  let position = body.position
  if (position === undefined) {
    const maxItem = db
      .select({ position: draftItems.position })
      .from(draftItems)
      .where(eq(draftItems.taskId, taskId))
      .orderBy(asc(draftItems.position))
      .all()
    position = maxItem.length > 0 ? Math.max(...maxItem.map((i) => i.position)) + 1 : 0
  }

  const now = new Date().toISOString()
  const item = {
    id: nanoid(),
    taskId,
    title: body.title.trim(),
    completed: false,
    issueUrl: null,
    issueNumber: null,
    position,
    createdAt: now,
    updatedAt: now,
  }

  db.insert(draftItems).values(item).run()
  broadcast({ type: 'draft-items:updated', payload: { taskId } })

  return c.json(item, 201)
})

// PATCH /api/draft-items/:itemId - Update a draft item
app.patch('/:itemId', async (c) => {
  const itemId = c.req.param('itemId')
  const body = await c.req.json<{
    title?: string
    completed?: boolean
    position?: number
    issueUrl?: string | null
    issueNumber?: number | null
  }>()

  const existing = db.select().from(draftItems).where(eq(draftItems.id, itemId)).get()
  if (!existing) {
    return c.json({ error: 'Draft item not found' }, 404)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.completed !== undefined) updates.completed = body.completed
  if (body.position !== undefined) updates.position = body.position
  if (body.issueUrl !== undefined) updates.issueUrl = body.issueUrl
  if (body.issueNumber !== undefined) updates.issueNumber = body.issueNumber

  db.update(draftItems).set(updates).where(eq(draftItems.id, itemId)).run()
  broadcast({ type: 'draft-items:updated', payload: { taskId: existing.taskId } })

  const updated = db.select().from(draftItems).where(eq(draftItems.id, itemId)).get()
  return c.json(updated)
})

// DELETE /api/draft-items/:itemId - Delete a draft item
app.delete('/:itemId', (c) => {
  const itemId = c.req.param('itemId')

  const existing = db.select().from(draftItems).where(eq(draftItems.id, itemId)).get()
  if (!existing) {
    return c.json({ error: 'Draft item not found' }, 404)
  }

  db.delete(draftItems).where(eq(draftItems.id, itemId)).run()
  broadcast({ type: 'draft-items:updated', payload: { taskId: existing.taskId } })

  return c.json({ success: true })
})

// POST /api/draft-items/:taskId/reorder - Bulk reorder items
app.post('/:taskId/reorder', async (c) => {
  const taskId = c.req.param('taskId')
  const body = await c.req.json<{ itemIds: string[] }>()

  if (!Array.isArray(body.itemIds)) {
    return c.json({ error: 'itemIds array is required' }, 400)
  }

  for (let i = 0; i < body.itemIds.length; i++) {
    db.update(draftItems)
      .set({ position: i, updatedAt: new Date().toISOString() })
      .where(eq(draftItems.id, body.itemIds[i]))
      .run()
  }

  broadcast({ type: 'draft-items:updated', payload: { taskId } })

  const items = db
    .select()
    .from(draftItems)
    .where(eq(draftItems.taskId, taskId))
    .orderBy(asc(draftItems.position))
    .all()

  return c.json(items)
})

// GET /api/draft-items/upstream/:taskId - Get upstream draft tasks with their items
// Used for prompt injection and review hook
app.get('/upstream/:taskId', (c) => {
  const taskId = c.req.param('taskId')

  // Find all tasks this task depends on
  const deps = db
    .select()
    .from(taskRelationships)
    .where(eq(taskRelationships.taskId, taskId))
    .all()

  if (deps.length === 0) {
    return c.json([])
  }

  // Get upstream tasks that are drafts
  const upstreamTaskIds = deps.map((d) => d.relatedTaskId)
  const upstreamDrafts = db
    .select()
    .from(tasks)
    .all()
    .filter((t) => upstreamTaskIds.includes(t.id) && t.type === 'draft')

  if (upstreamDrafts.length === 0) {
    return c.json([])
  }

  // Get items for each draft
  const result = upstreamDrafts.map((draft) => {
    const items = db
      .select()
      .from(draftItems)
      .where(eq(draftItems.taskId, draft.id))
      .orderBy(asc(draftItems.position))
      .all()

    return {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      items,
    }
  })

  return c.json(result)
})

// POST /api/draft-items/:taskId/sync-issues - Create GitHub issues for items without one
app.post('/:taskId/sync-issues', async (c) => {
  const taskId = c.req.param('taskId')

  const task = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  // Find the repository to get GitHub owner/repo
  const repoId = task.repositoryId
  if (!repoId) {
    return c.json({ error: 'Task has no associated repository' }, 400)
  }

  const repo = db.select().from(repositories).where(eq(repositories.id, repoId)).get()
  if (!repo?.remoteUrl) {
    return c.json({ error: 'Repository has no remote URL' }, 400)
  }

  const parsed = parseGitHubRemoteUrl(repo.remoteUrl)
  if (!parsed) {
    return c.json({ error: 'Repository remote is not a GitHub URL' }, 400)
  }

  const pat = getSetting('integrations.githubPat')
  if (!pat) {
    return c.json({ error: 'GitHub PAT not configured' }, 400)
  }

  const items = db
    .select()
    .from(draftItems)
    .where(eq(draftItems.taskId, taskId))
    .orderBy(asc(draftItems.position))
    .all()

  const itemsToSync = items.filter((item) => !item.issueUrl)
  if (itemsToSync.length === 0) {
    return c.json({ created: 0, errors: [] })
  }

  let created = 0
  const errors: string[] = []

  for (const item of itemsToSync) {
    try {
      const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: item.title }),
      })

      if (!res.ok) {
        const errorBody = await res.text()
        errors.push(`Failed to create issue for "${item.title}": ${res.status} ${errorBody}`)
        continue
      }

      const issue = await res.json() as { html_url: string; number: number }
      db.update(draftItems)
        .set({ issueUrl: issue.html_url, issueNumber: issue.number, updatedAt: new Date().toISOString() })
        .where(eq(draftItems.id, item.id))
        .run()
      created++
    } catch (err) {
      errors.push(`Failed to create issue for "${item.title}": ${err}`)
    }
  }

  if (created > 0) {
    broadcast({ type: 'draft-items:updated', payload: { taskId } })
  }

  return c.json({ created, errors })
})

export default app
