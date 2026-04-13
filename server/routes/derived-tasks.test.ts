import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestGitRepo, type TestGitRepo } from '../__tests__/fixtures/git'
import { createTestApp } from '../__tests__/fixtures/app'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'
import { db, tasks, taskRelationships } from '../db'
import { eq, and, or } from 'drizzle-orm'

function insertTask(id: string, title: string, repoPath: string, baseBranch: string, status = 'IN_PROGRESS') {
  const now = new Date().toISOString()
  db.insert(tasks)
    .values({
      id,
      title,
      status,
      position: 0,
      repoPath,
      repoName: 'test-repo',
      baseBranch,
      createdAt: now,
      updatedAt: now,
    })
    .run()
}

function addDependency(taskId: string, dependsOnTaskId: string) {
  db.insert(taskRelationships)
    .values({
      id: crypto.randomUUID(),
      taskId,
      relatedTaskId: dependsOnTaskId,
      type: 'depends_on',
      createdAt: new Date().toISOString(),
    })
    .run()
}

function getDependencies(taskId: string) {
  return db
    .select()
    .from(taskRelationships)
    .where(
      and(
        eq(taskRelationships.taskId, taskId),
        eq(taskRelationships.type, 'depends_on')
      )
    )
    .all()
}

describe('Derived Tasks', () => {
  let testEnv: TestEnv
  let repo: TestGitRepo

  beforeEach(() => {
    testEnv = setupTestEnv()
    repo = createTestGitRepo()
  })

  afterEach(() => {
    repo.cleanup()
    testEnv.cleanup()
  })

  test('derived task makes parent depend on it', async () => {
    const { post } = createTestApp()

    // Create parent task
    insertTask('parent-1', 'Deploy backend', repo.path, repo.defaultBranch)

    // Create derived task
    const res = await post('/api/tasks', {
      title: 'Deploy database',
      derivedFromTaskId: 'parent-1',
      status: 'TO_DO',
    })
    const derived = await res.json()

    expect(res.status).toBe(201)
    expect(derived.title).toBe('Deploy database')

    // Parent should now depend on derived task
    const parentDeps = getDependencies('parent-1')
    expect(parentDeps).toHaveLength(1)
    expect(parentDeps[0].relatedTaskId).toBe(derived.id)
  })

  test('derived task propagates dependency to tasks that depend on parent', async () => {
    const { post } = createTestApp()

    // Setup: task02 depends_on task01
    insertTask('task-01', 'Deploy backend', repo.path, repo.defaultBranch)
    insertTask('task-02', 'Run integration tests', repo.path, repo.defaultBranch)
    addDependency('task-02', 'task-01')

    // Create derived task from task01
    const res = await post('/api/tasks', {
      title: 'Deploy database',
      derivedFromTaskId: 'task-01',
      status: 'TO_DO',
    })
    const derived = await res.json()

    expect(res.status).toBe(201)

    // task01 should depend on derived
    const task01Deps = getDependencies('task-01')
    expect(task01Deps).toHaveLength(1)
    expect(task01Deps[0].relatedTaskId).toBe(derived.id)

    // task02 should now depend on BOTH task01 AND derived
    const task02Deps = getDependencies('task-02')
    expect(task02Deps).toHaveLength(2)
    const task02DepIds = task02Deps.map((d) => d.relatedTaskId).sort()
    expect(task02DepIds).toEqual([derived.id, 'task-01'].sort())
  })

  test('derived task propagates to multiple dependents', async () => {
    const { post } = createTestApp()

    // Setup: task02 and task03 both depend on task01
    insertTask('task-01', 'Setup infrastructure', repo.path, repo.defaultBranch)
    insertTask('task-02', 'Deploy frontend', repo.path, repo.defaultBranch)
    insertTask('task-03', 'Deploy backend', repo.path, repo.defaultBranch)
    addDependency('task-02', 'task-01')
    addDependency('task-03', 'task-01')

    // Create derived task from task01
    const res = await post('/api/tasks', {
      title: 'Configure DNS',
      derivedFromTaskId: 'task-01',
      status: 'TO_DO',
    })
    const derived = await res.json()

    // Both task02 and task03 should now also depend on derived
    const task02Deps = getDependencies('task-02')
    const task03Deps = getDependencies('task-03')

    expect(task02Deps).toHaveLength(2)
    expect(task03Deps).toHaveLength(2)

    expect(task02Deps.some((d) => d.relatedTaskId === derived.id)).toBe(true)
    expect(task03Deps.some((d) => d.relatedTaskId === derived.id)).toBe(true)
  })

  test('derived task does not create duplicate dependencies', async () => {
    const { post } = createTestApp()

    insertTask('task-01', 'Deploy backend', repo.path, repo.defaultBranch)

    // Create first derived task
    const res1 = await post('/api/tasks', {
      title: 'Deploy database',
      derivedFromTaskId: 'task-01',
      status: 'TO_DO',
    })
    const derived1 = await res1.json()

    // Create second derived task from same parent
    const res2 = await post('/api/tasks', {
      title: 'Setup networking',
      derivedFromTaskId: 'task-01',
      status: 'TO_DO',
    })
    const derived2 = await res2.json()

    // Parent should depend on both derived tasks
    const parentDeps = getDependencies('task-01')
    expect(parentDeps).toHaveLength(2)
    const depIds = parentDeps.map((d) => d.relatedTaskId).sort()
    expect(depIds).toEqual([derived1.id, derived2.id].sort())
  })

  test('derived task with non-existent parent returns 400', async () => {
    const { post } = createTestApp()

    const res = await post('/api/tasks', {
      title: 'Orphan task',
      derivedFromTaskId: 'non-existent-id',
      status: 'TO_DO',
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Parent task not found for derivation')
  })

  test('derived task works together with blockedByTaskIds', async () => {
    const { post } = createTestApp()

    insertTask('task-01', 'Deploy backend', repo.path, repo.defaultBranch)
    insertTask('task-prereq', 'Get credentials', repo.path, repo.defaultBranch)

    // Create derived task that is also blocked by another task
    const res = await post('/api/tasks', {
      title: 'Deploy database',
      derivedFromTaskId: 'task-01',
      blockedByTaskIds: ['task-prereq'],
      status: 'TO_DO',
    })
    const derived = await res.json()

    expect(res.status).toBe(201)

    // Parent should depend on derived
    const parentDeps = getDependencies('task-01')
    expect(parentDeps).toHaveLength(1)
    expect(parentDeps[0].relatedTaskId).toBe(derived.id)

    // Derived should depend on prereq
    const derivedDeps = getDependencies(derived.id)
    expect(derivedDeps).toHaveLength(1)
    expect(derivedDeps[0].relatedTaskId).toBe('task-prereq')
  })

  test('chained derived tasks create correct dependency graph', async () => {
    const { post } = createTestApp()

    // task02 depends_on task01
    insertTask('task-01', 'Deploy backend', repo.path, repo.defaultBranch)
    insertTask('task-02', 'Run tests', repo.path, repo.defaultBranch)
    addDependency('task-02', 'task-01')

    // Derive task03 from task01
    const res1 = await post('/api/tasks', {
      title: 'Deploy database',
      derivedFromTaskId: 'task-01',
      status: 'TO_DO',
    })
    const task03 = await res1.json()

    // Now derive task04 from task03 (nested derivation)
    const res2 = await post('/api/tasks', {
      title: 'Setup DB schema',
      derivedFromTaskId: task03.id,
      status: 'TO_DO',
    })
    const task04 = await res2.json()

    // task03 should depend on task04
    const task03Deps = getDependencies(task03.id)
    expect(task03Deps).toHaveLength(1)
    expect(task03Deps[0].relatedTaskId).toBe(task04.id)

    // task01 should depend on task03 (from first derivation)
    // AND task01 should depend on task04 (propagated because task01 depends_on task03)
    const task01Deps = getDependencies('task-01')
    expect(task01Deps).toHaveLength(2)
    const task01DepIds = task01Deps.map((d) => d.relatedTaskId).sort()
    expect(task01DepIds).toEqual([task03.id, task04.id].sort())

    // task02 should depend on task01, task03, AND task04
    const task02Deps = getDependencies('task-02')
    expect(task02Deps).toHaveLength(3)
    const task02DepIds = task02Deps.map((d) => d.relatedTaskId).sort()
    expect(task02DepIds).toEqual(['task-01', task03.id, task04.id].sort())
  })

  test('derive from DONE task returns 400', async () => {
    const { post } = createTestApp()

    insertTask('done-task', 'Finished work', repo.path, repo.defaultBranch, 'DONE')

    const res = await post('/api/tasks', {
      title: 'Too late',
      derivedFromTaskId: 'done-task',
      status: 'TO_DO',
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Cannot derive from a DONE task')
  })

  test('derive from CANCELED task returns 400', async () => {
    const { post } = createTestApp()

    insertTask('canceled-task', 'Canceled work', repo.path, repo.defaultBranch, 'CANCELED')

    const res = await post('/api/tasks', {
      title: 'Too late',
      derivedFromTaskId: 'canceled-task',
      status: 'TO_DO',
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Cannot derive from a CANCELED task')
  })

  test('derivedFromTaskId + blockedByTaskIds creating cycle is rejected', async () => {
    const { post } = createTestApp()

    // A depends_on B
    insertTask('task-a', 'Task A', repo.path, repo.defaultBranch)
    insertTask('task-b', 'Task B', repo.path, repo.defaultBranch)
    addDependency('task-a', 'task-b')

    // Try to derive from A with blockedBy B → derived depends_on B, B depends_on... no cycle actually
    // Real cycle: derive from A, blockedBy the derived itself — but that's self-ref filtered
    // Actual cycle test: A→B exists. Derive from B with blockedByTaskIds: [A]
    // This would create: B→derived, A→derived (propagated from B), derived→A (blockedBy)
    // Check: A→derived→A? No, A→B→derived and derived→A = cycle!
    const res = await post('/api/tasks', {
      title: 'Cycle maker',
      derivedFromTaskId: 'task-b',
      blockedByTaskIds: ['task-a'],
      status: 'TO_DO',
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Circular dependency')
  })

  test('derivedFromTaskId is persisted in task record', async () => {
    const { post, get } = createTestApp()

    insertTask('parent-persist', 'Parent task', repo.path, repo.defaultBranch)

    const res = await post('/api/tasks', {
      title: 'Derived with lineage',
      derivedFromTaskId: 'parent-persist',
      status: 'TO_DO',
    })
    const derived = await res.json()

    expect(derived.derivedFromTaskId).toBe('parent-persist')

    // Verify via GET
    const getRes = await get(`/api/tasks/${derived.id}`)
    const fetched = await getRes.json()
    expect(fetched.derivedFromTaskId).toBe('parent-persist')
  })

  test('create_task response includes _derivationResult', async () => {
    const { post } = createTestApp()

    insertTask('parent-result', 'Parent', repo.path, repo.defaultBranch)
    insertTask('upstream-1', 'Upstream', repo.path, repo.defaultBranch)
    addDependency('upstream-1', 'parent-result')

    const res = await post('/api/tasks', {
      title: 'Derived with result',
      derivedFromTaskId: 'parent-result',
      status: 'TO_DO',
    })
    const body = await res.json()

    expect(body._derivationResult).toBeDefined()
    expect(body._derivationResult.parentBlocked).toBe(true)
    expect(body._derivationResult.propagatedTo).toContain('upstream-1')
    expect(body._derivationResult.guidance).toContain('Stop working on the current task')
  })

  test('deleting derived task cleans up relationships', async () => {
    const { post, delete: del } = createTestApp()

    insertTask('parent-del', 'Parent', repo.path, repo.defaultBranch)
    insertTask('upstream-del', 'Upstream', repo.path, repo.defaultBranch)
    addDependency('upstream-del', 'parent-del')

    const res = await post('/api/tasks', {
      title: 'To be deleted',
      derivedFromTaskId: 'parent-del',
      status: 'TO_DO',
    })
    const derived = await res.json()

    // Verify relationships exist
    const relsBefore = db.select().from(taskRelationships)
      .where(or(eq(taskRelationships.relatedTaskId, derived.id), eq(taskRelationships.taskId, derived.id)))
      .all()
    expect(relsBefore.length).toBeGreaterThan(0)

    // Delete derived task
    const delRes = await del(`/api/tasks/${derived.id}`)
    expect(delRes.status).toBe(200)

    // Verify relationships are cleaned up
    const relsAfter = db.select().from(taskRelationships)
      .where(or(eq(taskRelationships.relatedTaskId, derived.id), eq(taskRelationships.taskId, derived.id)))
      .all()
    expect(relsAfter).toHaveLength(0)
  })
})
