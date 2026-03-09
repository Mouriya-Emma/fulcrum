import { Hono } from 'hono'
import { search } from '../services/search-service'

const app = new Hono()

app.get('/', async (c) => {
  const q = c.req.query('q')
  if (!q) {
    return c.json({ error: 'Missing query parameter: q' }, 400)
  }

  const entitiesParam = c.req.query('entities')
  const entities = entitiesParam
    ? (entitiesParam.split(',').map((e) => e.trim()) as ('tasks' | 'projects' | 'messages' | 'events' | 'memories' | 'conversations' | 'gmail')[])
    : undefined

  const limitParam = c.req.query('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  const taskStatusParam = c.req.query('taskStatus')
  const taskStatus = taskStatusParam ? taskStatusParam.split(',').map((s) => s.trim()) : undefined

  const memoryTagsParam = c.req.query('memoryTags')
  const memoryTags = memoryTagsParam ? memoryTagsParam.split(',').map((t) => t.trim()) : undefined

  try {
    const results = await search({
      query: q.trim(),
      entities,
      limit,
      taskStatus,
      projectStatus: c.req.query('projectStatus') as 'active' | 'archived' | undefined,
      messageChannel: c.req.query('messageChannel'),
      messageDirection: c.req.query('messageDirection') as 'incoming' | 'outgoing' | undefined,
      eventFrom: c.req.query('eventFrom'),
      eventTo: c.req.query('eventTo'),
      memoryTags,
      conversationRole: c.req.query('conversationRole'),
      conversationProvider: c.req.query('conversationProvider'),
      conversationProjectId: c.req.query('conversationProjectId'),
      gmailFrom: c.req.query('gmailFrom'),
      gmailTo: c.req.query('gmailTo'),
      gmailAfter: c.req.query('gmailAfter'),
      gmailBefore: c.req.query('gmailBefore'),
    })

    return c.json(results)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Search failed' }, 500)
  }
})

export default app
