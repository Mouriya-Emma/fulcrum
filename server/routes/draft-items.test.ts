import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp } from '../__tests__/fixtures/app'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'

describe('Draft Items Routes', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  // Helper: create a draft task and return its id
  async function createDraftTask(
    client: ReturnType<typeof createTestApp>,
    opts: { title?: string; projectId?: string } = {}
  ) {
    const res = await client.post('/api/tasks', {
      title: opts.title || 'Draft Task',
      type: 'draft',
      status: 'TO_DO',
      projectId: opts.projectId || null,
    })
    const body = await res.json()
    return body.id as string
  }

  // Helper: create a draft item and return the response body
  async function createItem(
    client: ReturnType<typeof createTestApp>,
    taskId: string,
    opts: { title?: string; position?: number; notes?: string | null } = {}
  ) {
    const res = await client.post(`/api/draft-items/${taskId}`, {
      title: opts.title || 'Item',
      position: opts.position,
      notes: opts.notes,
    })
    return { res, body: await res.json() }
  }

  describe('POST /api/draft-items/:taskId - Create', () => {
    test('creates a draft item with auto-assigned position', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { res, body } = await createItem(client, taskId, { title: 'First item' })

      expect(res.status).toBe(201)
      expect(body.id).toBeDefined()
      expect(body.taskId).toBe(taskId)
      expect(body.title).toBe('First item')
      expect(body.completed).toBe(false)
      expect(body.position).toBe(0)
      expect(body.notes).toBeNull()
      expect(body.createdAt).toBeDefined()
      expect(body.updatedAt).toBeDefined()
    })

    test('auto-increments position for subsequent items', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      await createItem(client, taskId, { title: 'First' })
      await createItem(client, taskId, { title: 'Second' })
      const { body: third } = await createItem(client, taskId, { title: 'Third' })

      expect(third.position).toBe(2)
    })

    test('respects explicit position', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body } = await createItem(client, taskId, { title: 'Custom pos', position: 5 })

      expect(body.position).toBe(5)
    })

    test('creates item with notes', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { res, body } = await createItem(client, taskId, {
        title: 'With notes',
        notes: 'Some detailed notes here',
      })

      expect(res.status).toBe(201)
      expect(body.notes).toBe('Some detailed notes here')
    })

    test('trims title whitespace', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body } = await createItem(client, taskId, { title: '  Padded title  ' })

      expect(body.title).toBe('Padded title')
    })

    test('rejects empty title', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.post(`/api/draft-items/${taskId}`, { title: '' })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('Title is required')
    })

    test('rejects whitespace-only title', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.post(`/api/draft-items/${taskId}`, { title: '   ' })

      expect(res.status).toBe(400)
    })

    test('returns 404 for non-existent task', async () => {
      const client = createTestApp()

      const res = await client.post('/api/draft-items/nonexistent-task-id', {
        title: 'Orphan item',
      })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toContain('Task not found')
    })
  })

  describe('GET /api/draft-items/:taskId - List', () => {
    test('returns empty array for task with no items', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.get(`/api/draft-items/${taskId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    test('returns items ordered by position', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      await createItem(client, taskId, { title: 'C', position: 2 })
      await createItem(client, taskId, { title: 'A', position: 0 })
      await createItem(client, taskId, { title: 'B', position: 1 })

      const res = await client.get(`/api/draft-items/${taskId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(3)
      expect(body[0].title).toBe('A')
      expect(body[1].title).toBe('B')
      expect(body[2].title).toBe('C')
    })

    test('returns empty array for non-existent task (no error)', async () => {
      const client = createTestApp()

      const res = await client.get('/api/draft-items/no-such-task')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })
  })

  describe('PATCH /api/draft-items/:itemId - Update', () => {
    test('updates title', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Original' })

      const res = await client.patch(`/api/draft-items/${created.id}`, { title: 'Updated' })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.title).toBe('Updated')
      expect(body.id).toBe(created.id)
    })

    test('updates completed flag', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Toggle me' })

      expect(created.completed).toBe(false)

      const res = await client.patch(`/api/draft-items/${created.id}`, { completed: true })
      const body = await res.json()

      expect(body.completed).toBe(true)
    })

    test('updates position', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Move me' })

      const res = await client.patch(`/api/draft-items/${created.id}`, { position: 99 })
      const body = await res.json()

      expect(body.position).toBe(99)
    })

    test('updates notes', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Item' })

      expect(created.notes).toBeNull()

      const res = await client.patch(`/api/draft-items/${created.id}`, {
        notes: 'New notes content',
      })
      const body = await res.json()

      expect(body.notes).toBe('New notes content')
    })

    test('clears notes by setting null', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, {
        title: 'Item',
        notes: 'Has notes',
      })

      const res = await client.patch(`/api/draft-items/${created.id}`, { notes: null })
      const body = await res.json()

      expect(body.notes).toBeNull()
    })

    test('updates issueUrl and issueNumber', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Linkable' })

      const res = await client.patch(`/api/draft-items/${created.id}`, {
        issueUrl: 'https://github.com/org/repo/issues/42',
        issueNumber: 42,
      })
      const body = await res.json()

      expect(body.issueUrl).toBe('https://github.com/org/repo/issues/42')
      expect(body.issueNumber).toBe(42)
    })

    test('updates updatedAt timestamp', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Timestamped' })

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10))

      const res = await client.patch(`/api/draft-items/${created.id}`, { title: 'Changed' })
      const body = await res.json()

      expect(body.updatedAt).not.toBe(created.updatedAt)
    })

    test('returns 404 for non-existent item', async () => {
      const client = createTestApp()

      const res = await client.patch('/api/draft-items/nonexistent-item-id', { title: 'Nope' })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toContain('Draft item not found')
    })
  })

  describe('DELETE /api/draft-items/:itemId - Delete', () => {
    test('deletes an existing item', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)
      const { body: created } = await createItem(client, taskId, { title: 'Delete me' })

      const res = await client.delete(`/api/draft-items/${created.id}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // Verify it's gone
      const listRes = await client.get(`/api/draft-items/${taskId}`)
      const items = await listRes.json()
      expect(items).toHaveLength(0)
    })

    test('returns 404 for non-existent item', async () => {
      const client = createTestApp()

      const res = await client.delete('/api/draft-items/nonexistent-item-id')
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error).toContain('Draft item not found')
    })
  })

  describe('POST /api/draft-items/:taskId/reorder - Reorder', () => {
    test('reorders items by given id sequence', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body: a } = await createItem(client, taskId, { title: 'A', position: 0 })
      const { body: b } = await createItem(client, taskId, { title: 'B', position: 1 })
      const { body: c_ } = await createItem(client, taskId, { title: 'C', position: 2 })

      // Reverse the order: C, B, A
      // itemIds array sets positions: index 0 → position 0, index 1 → position 1, etc.
      // So C gets position 0, B gets position 1, A gets position 2
      const res = await client.post(`/api/draft-items/${taskId}/reorder`, {
        itemIds: [c_.id, b.id, a.id],
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(3)
      // Response is ordered by position ascending
      expect(body[0].title).toBe('C')
      expect(body[0].position).toBe(0)
      expect(body[1].title).toBe('B')
      expect(body[1].position).toBe(1)
      expect(body[2].title).toBe('A')
      expect(body[2].position).toBe(2)
    })

    test('rejects missing itemIds', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.post(`/api/draft-items/${taskId}/reorder`, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('itemIds array is required')
    })
  })

  describe('GET /api/draft-items/upstream/:taskId - Upstream Draft Lookup', () => {
    test('returns upstream draft with items', async () => {
      const client = createTestApp()

      // Create a draft task with items
      const draftId = await createDraftTask(client, { title: 'Planning Draft' })
      await createItem(client, draftId, { title: 'Step 1' })
      await createItem(client, draftId, { title: 'Step 2' })

      // Create a downstream task
      const downstreamId = await createDraftTask(client, { title: 'Implementation' })

      // Create a dependency: downstream depends_on draft
      await client.post(`/api/task-dependencies/${downstreamId}`, {
        dependsOnTaskId: draftId,
      })

      const res = await client.get(`/api/draft-items/upstream/${downstreamId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].id).toBe(draftId)
      expect(body[0].title).toBe('Planning Draft')
      expect(body[0].items).toHaveLength(2)
      expect(body[0].items[0].title).toBe('Step 1')
      expect(body[0].items[1].title).toBe('Step 2')
      expect(body[0].downstreamTasks).toBeDefined()
    })

    test('returns empty array when task has no dependencies', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.get(`/api/draft-items/upstream/${taskId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    test('returns empty array when upstream tasks are not drafts', async () => {
      const client = createTestApp()

      // Create a non-draft (worktree/manual) upstream task
      const upstreamRes = await client.post('/api/tasks', {
        title: 'Regular Task',
        type: null,
        status: 'TO_DO',
      })
      const upstream = await upstreamRes.json()

      const downstreamId = await createDraftTask(client, { title: 'Downstream' })

      // Create dependency
      await client.post(`/api/task-dependencies/${downstreamId}`, {
        dependsOnTaskId: upstream.id,
      })

      const res = await client.get(`/api/draft-items/upstream/${downstreamId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    test('returns draft with no items (empty items array)', async () => {
      const client = createTestApp()

      // Create an empty draft
      const draftId = await createDraftTask(client, { title: 'Empty Draft' })

      const downstreamId = await createDraftTask(client, { title: 'Consumer' })

      await client.post(`/api/task-dependencies/${downstreamId}`, {
        dependsOnTaskId: draftId,
      })

      const res = await client.get(`/api/draft-items/upstream/${downstreamId}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].items).toEqual([])
    })

    test('includes downstream tasks in response', async () => {
      const client = createTestApp()

      const draftId = await createDraftTask(client, { title: 'Shared Draft' })
      await createItem(client, draftId, { title: 'Checklist item' })

      // Create two downstream tasks that depend on this draft
      const downA = await createDraftTask(client, { title: 'Worker A' })
      const downB = await createDraftTask(client, { title: 'Worker B' })

      await client.post(`/api/task-dependencies/${downA}`, { dependsOnTaskId: draftId })
      await client.post(`/api/task-dependencies/${downB}`, { dependsOnTaskId: draftId })

      // Query from Worker A's perspective
      const res = await client.get(`/api/draft-items/upstream/${downA}`)
      const body = await res.json()

      expect(body).toHaveLength(1)
      // Both Worker A and Worker B should appear as downstream tasks
      expect(body[0].downstreamTasks).toHaveLength(2)
      const titles = body[0].downstreamTasks.map((t: { title: string }) => t.title).sort()
      expect(titles).toEqual(['Worker A', 'Worker B'])
    })
  })

  describe('PATCH /api/draft-items/:taskId/batch - Batch Update', () => {
    test('batch updates multiple items', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body: a } = await createItem(client, taskId, { title: 'A' })
      const { body: b } = await createItem(client, taskId, { title: 'B' })
      const { body: c_ } = await createItem(client, taskId, { title: 'C' })

      const res = await client.patch(`/api/draft-items/${taskId}/batch`, {
        items: [
          { id: a.id, completed: true },
          { id: b.id, title: 'B Updated' },
          { id: c_.id, completed: true, title: 'C Done' },
        ],
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(3)

      const itemMap = new Map(body.map((i: { id: string }) => [i.id, i]))
      const updatedA = itemMap.get(a.id) as { completed: boolean; title: string }
      const updatedB = itemMap.get(b.id) as { completed: boolean; title: string }
      const updatedC = itemMap.get(c_.id) as { completed: boolean; title: string }

      expect(updatedA.completed).toBe(true)
      expect(updatedA.title).toBe('A') // title unchanged
      expect(updatedB.title).toBe('B Updated')
      expect(updatedB.completed).toBe(false) // completed unchanged
      expect(updatedC.completed).toBe(true)
      expect(updatedC.title).toBe('C Done')
    })

    test('rejects empty items array', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.patch(`/api/draft-items/${taskId}/batch`, { items: [] })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('items array is required')
    })

    test('rejects missing items field', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const res = await client.patch(`/api/draft-items/${taskId}/batch`, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toContain('items array is required')
    })

    test('skips items belonging to a different task', async () => {
      const client = createTestApp()
      const taskA = await createDraftTask(client, { title: 'Task A' })
      const taskB = await createDraftTask(client, { title: 'Task B' })

      const { body: itemA } = await createItem(client, taskA, { title: 'In A' })
      const { body: itemB } = await createItem(client, taskB, { title: 'In B' })

      // Try to batch update taskA but include itemB
      const res = await client.patch(`/api/draft-items/${taskA}/batch`, {
        items: [
          { id: itemA.id, completed: true },
          { id: itemB.id, completed: true }, // should be skipped
        ],
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      // Only items from taskA are returned
      expect(body).toHaveLength(1)
      expect(body[0].completed).toBe(true)

      // Verify itemB was not modified
      const taskBItems = await client.get(`/api/draft-items/${taskB}`)
      const bItems = await taskBItems.json()
      expect(bItems[0].completed).toBe(false)
    })
  })

  describe('Cascade Delete - Task deletion cleans up draft items', () => {
    test('deleting a task removes its draft items', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      await createItem(client, taskId, { title: 'Item 1' })
      await createItem(client, taskId, { title: 'Item 2' })
      await createItem(client, taskId, { title: 'Item 3' })

      // Verify items exist
      const beforeRes = await client.get(`/api/draft-items/${taskId}`)
      const before = await beforeRes.json()
      expect(before).toHaveLength(3)

      // Delete the task
      const deleteRes = await client.delete(`/api/tasks/${taskId}`)
      expect(deleteRes.status).toBe(200)

      // Verify items are gone
      const afterRes = await client.get(`/api/draft-items/${taskId}`)
      const after = await afterRes.json()
      expect(after).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    test('creating multiple items without explicit position assigns sequential positions', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body: first } = await createItem(client, taskId, { title: 'First' })
      const { body: second } = await createItem(client, taskId, { title: 'Second' })
      const { body: third } = await createItem(client, taskId, { title: 'Third' })

      expect(first.position).toBe(0)
      expect(second.position).toBe(1)
      expect(third.position).toBe(2)
    })

    test('notes are trimmed on create', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body } = await createItem(client, taskId, {
        title: 'Noted',
        notes: '  trimmed notes  ',
      })

      expect(body.notes).toBe('trimmed notes')
    })

    test('null notes on create results in null', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body } = await createItem(client, taskId, {
        title: 'No notes',
        notes: null,
      })

      expect(body.notes).toBeNull()
    })

    test('issueUrl and issueNumber default to null', async () => {
      const client = createTestApp()
      const taskId = await createDraftTask(client)

      const { body } = await createItem(client, taskId, { title: 'Fresh item' })

      expect(body.issueUrl).toBeNull()
      expect(body.issueNumber).toBeNull()
    })

    test('CRUD operations work for non-existent task on GET (returns empty)', async () => {
      const client = createTestApp()

      // GET for non-existent task returns empty array (not 404)
      const res = await client.get('/api/draft-items/fake-task-id')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })
  })
})
