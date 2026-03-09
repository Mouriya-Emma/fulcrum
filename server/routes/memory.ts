import { Hono } from 'hono'
import { storeMemory, searchMemories, deleteMemory, listMemories, updateMemory } from '../services/memory-service'

const app = new Hono()

// POST / - Store a new memory
app.post('/', async (c) => {
  const body = await c.req.json<{ content: string; tags?: string[]; source?: string }>()
  if (!body.content || !body.content.trim()) {
    return c.json({ error: 'content is required and cannot be empty' }, 400)
  }
  const memory = await storeMemory({
    content: body.content.trim(),
    tags: body.tags,
    source: body.source,
  })
  return c.json(memory, 201)
})

// GET /search - Search memories via FTS5
app.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) {
    return c.json({ error: 'Missing query parameter: q' }, 400)
  }

  const tagsParam = c.req.query('tags')
  const limitParam = c.req.query('limit')
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  const results = await searchMemories({
    query: q.trim(),
    tags,
    limit,
  })

  return c.json(results)
})

// GET / - List memories with optional filtering
app.get('/', async (c) => {
  const tagsParam = c.req.query('tags')
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const limit = limitParam ? parseInt(limitParam, 10) : undefined
  const offset = offsetParam ? parseInt(offsetParam, 10) : undefined

  const result = await listMemories({ tags, limit, offset })
  return c.json(result)
})

// PATCH /:id - Update a memory
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ content?: string; tags?: string[] | null; source?: string | null }>()

  if (body.content !== undefined && !body.content.trim()) {
    return c.json({ error: 'content cannot be empty' }, 400)
  }

  const updated = await updateMemory(id, {
    content: body.content?.trim(),
    tags: body.tags,
    source: body.source,
  })

  if (!updated) {
    return c.json({ error: 'Memory not found' }, 404)
  }

  return c.json(updated)
})

// DELETE /:id - Delete a memory
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const deleted = await deleteMemory(id)

  if (!deleted) {
    return c.json({ error: 'Memory not found' }, 404)
  }

  return c.json({ success: true })
})

export default app
