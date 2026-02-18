import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { storeMemory, searchMemories, deleteMemory, listMemories, updateMemory } from '../services/memory-service'

const app = new OpenAPIHono()

// POST / - Store a new memory
const storeRoute = createRoute({
  method: 'post',
  path: '/',
  operationId: 'memory-store',
  tags: ['memory'],
  summary: 'Store a memory',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string().min(1),
            tags: z.array(z.string()).optional(),
            source: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Memory created' },
    400: { description: 'Validation error' },
  },
})

app.openapi(storeRoute, async (c) => {
  const body = c.req.valid('json')
  const memory = await storeMemory({
    content: body.content.trim(),
    tags: body.tags,
    source: body.source,
  })
  return c.json(memory, 201)
})

// GET /search - Search memories via FTS5
const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  operationId: 'memory-search',
  tags: ['memory'],
  summary: 'Search memories (FTS5)',
  request: {
    query: z.object({
      q: z.string().min(1),
      tags: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Search results' },
    400: { description: 'Missing query parameter' },
  },
})

app.openapi(searchRoute, async (c) => {
  const { q, tags: tagsParam, limit: limitParam } = c.req.valid('query')
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
const listRoute = createRoute({
  method: 'get',
  path: '/',
  operationId: 'memory-list',
  tags: ['memory'],
  summary: 'List memories',
  request: {
    query: z.object({
      tags: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Memory list' },
  },
})

app.openapi(listRoute, async (c) => {
  const { tags: tagsParam, limit: limitParam, offset: offsetParam } = c.req.valid('query')
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const limit = limitParam ? parseInt(limitParam, 10) : undefined
  const offset = offsetParam ? parseInt(offsetParam, 10) : undefined

  const result = await listMemories({ tags, limit, offset })
  return c.json(result)
})

// PATCH /:id - Update a memory
const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  operationId: 'memory-update',
  tags: ['memory'],
  summary: 'Update a memory',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string().optional(),
            tags: z.array(z.string()).nullable().optional(),
            source: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Memory updated' },
    400: { description: 'Validation error' },
    404: { description: 'Memory not found' },
  },
})

app.openapi(updateRoute, async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

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
const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  operationId: 'memory-delete',
  tags: ['memory'],
  summary: 'Delete a memory',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: { description: 'Memory deleted' },
    404: { description: 'Memory not found' },
  },
})

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid('param')
  const deleted = await deleteMemory(id)

  if (!deleted) {
    return c.json({ error: 'Memory not found' }, 404)
  }

  return c.json({ success: true })
})

export default app
