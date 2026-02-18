import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { search } from '../services/search-service'

const app = new OpenAPIHono()

const searchRoute = createRoute({
  method: 'get',
  path: '/',
  operationId: 'search-query',
  tags: ['search'],
  summary: 'Search across tasks, projects, messages, events, memories, conversations',
  request: {
    query: z.object({
      q: z.string().min(1),
      entities: z.string().optional(),
      limit: z.string().optional(),
      taskStatus: z.string().optional(),
      projectStatus: z.string().optional(),
      messageChannel: z.string().optional(),
      messageDirection: z.string().optional(),
      eventFrom: z.string().optional(),
      eventTo: z.string().optional(),
      memoryTags: z.string().optional(),
      conversationRole: z.string().optional(),
      conversationProvider: z.string().optional(),
      conversationProjectId: z.string().optional(),
      gmailFrom: z.string().optional(),
      gmailTo: z.string().optional(),
      gmailAfter: z.string().optional(),
      gmailBefore: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Search results' },
    400: { description: 'Missing query parameter' },
    500: { description: 'Search failed' },
  },
})

app.openapi(searchRoute, async (c) => {
  const query = c.req.valid('query')

  const entitiesParam = query.entities
  const entities = entitiesParam
    ? (entitiesParam.split(',').map((e) => e.trim()) as ('tasks' | 'projects' | 'messages' | 'events' | 'memories' | 'conversations' | 'gmail')[])
    : undefined

  const limitParam = query.limit
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  const taskStatusParam = query.taskStatus
  const taskStatus = taskStatusParam ? taskStatusParam.split(',').map((s) => s.trim()) : undefined

  const memoryTagsParam = query.memoryTags
  const memoryTags = memoryTagsParam ? memoryTagsParam.split(',').map((t) => t.trim()) : undefined

  try {
    const results = await search({
      query: query.q.trim(),
      entities,
      limit,
      taskStatus,
      projectStatus: query.projectStatus as 'active' | 'archived' | undefined,
      messageChannel: query.messageChannel,
      messageDirection: query.messageDirection as 'incoming' | 'outgoing' | undefined,
      eventFrom: query.eventFrom,
      eventTo: query.eventTo,
      memoryTags,
      conversationRole: query.conversationRole,
      conversationProvider: query.conversationProvider,
      conversationProjectId: query.conversationProjectId,
      gmailFrom: query.gmailFrom,
      gmailTo: query.gmailTo,
      gmailAfter: query.gmailAfter,
      gmailBefore: query.gmailBefore,
    })

    return c.json(results)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Search failed' }, 500)
  }
})

export default app
