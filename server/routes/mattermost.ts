/**
 * Mattermost integration routes.
 *
 * POST /commands  — Slash command handler (/f)
 * POST /actions   — Interactive button/select callbacks
 * POST /dialogs   — Dialog (modal form) submissions
 */

import { Hono } from 'hono'
import { getSettings } from '../lib/settings'
import { log } from '../lib/logger'
import { updateTaskStatus } from '../services/task-status'
import { db, tasks, projects, repositories, apps } from '../db'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  buildDashboardCard,
  buildTaskListCard,
  buildTaskDetailCard,
  buildAppsCard,
  buildAppDetailCard,
  buildMonitorCard,
  buildProjectsCard,
  buildSearchCard,
} from '../services/mattermost/cards'
import { openDialog, postMessage, getActionsUrl } from '../services/mattermost/client'
import type { MattermostDialog } from '../services/mattermost/client'

const app = new Hono()

// --- Slash Command Handler ---
// Mattermost sends application/x-www-form-urlencoded
app.post('/commands', async (c) => {
  const body = await c.req.parseBody()
  const token = body.token as string
  const text = (body.text as string || '').trim()
  const triggerId = body.trigger_id as string
  const channelId = body.channel_id as string
  const userId = body.user_id as string

  // Verify command token
  const config = getSettings().channels.mattermost
  if (config.commandToken && token !== config.commandToken) {
    return c.json({ response_type: 'ephemeral', text: 'Invalid command token.' })
  }

  try {
    const attachment = await dispatchCommand(text, triggerId, channelId, userId)
    return c.json({
      response_type: 'in_channel',
      props: { attachments: [attachment] },
    })
  } catch (err) {
    log.error('Mattermost command error', { text, error: String(err) })
    return c.json({
      response_type: 'ephemeral',
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
})

// Command dispatcher - parse subcommand and args
async function dispatchCommand(text: string, triggerId: string, channelId: string, userId: string) {
  const parts = text.split(/\s+/)
  const subcommand = parts[0]?.toLowerCase() || ''
  const args = parts.slice(1).join(' ')

  switch (subcommand) {
    case '':
      return buildDashboardCard()

    case 'tasks': {
      const filter = parseTaskFilter(args)
      return buildTaskListCard(filter)
    }

    case 'task': {
      if (!args) return buildTaskListCard()
      return buildTaskDetailCard(args.trim())
    }

    case 'new': {
      await openCreateTaskDialog(triggerId, args)
      return { text: '_Opening create task dialog..._', color: '#7C3AED' }
    }

    case 'deploy': {
      if (!args) return buildAppsCard()
      // Find app by name
      const allApps = db.select().from(apps).all()
      const matched = allApps.find(a => a.name.toLowerCase() === args.toLowerCase())
      if (!matched) {
        return { text: `App "${args}" not found. Use \`/f apps\` to list all apps.`, color: '#EF4444' }
      }
      return buildAppDetailCard(matched.id)
    }

    case 'apps':
      return buildAppsCard()

    case 'search':
      if (!args) return { text: 'Usage: `/f search <keywords>`', color: '#6B7280' }
      return buildSearchCard(args)

    case 'monitor':
      return buildMonitorCard()

    case 'projects':
      return buildProjectsCard()

    case 'help':
      return buildHelpCard()

    default:
      // Try as task ID
      if (subcommand.match(/^[a-zA-Z0-9_-]{4,}$/)) {
        const card = await buildTaskDetailCard(subcommand)
        if (card.pretext?.includes('not found')) {
          return buildHelpCard()
        }
        return card
      }
      return buildHelpCard()
  }
}

function parseTaskFilter(args: string) {
  const filter: { status?: string; priority?: string; projectId?: string; tag?: string } = {}
  if (!args) return { status: 'active' }

  const parts = args.split(/\s+/)
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (['doing', 'progress', 'wip', 'review', 'todo', 'done', 'canceled'].includes(lower)) {
      filter.status = lower
    } else if (['high', 'medium', 'low'].includes(lower)) {
      filter.priority = lower
    } else if (part.startsWith('#')) {
      filter.tag = part.slice(1)
    } else if (part.startsWith('@')) {
      // Find project by name
      const name = part.slice(1)
      const proj = db.select().from(projects).all().find(p => p.name.toLowerCase() === name.toLowerCase())
      if (proj) filter.projectId = proj.id
    } else {
      filter.status = lower
    }
  }

  return filter
}

function buildHelpCard() {
  return {
    fallback: 'Fulcrum Help',
    color: '#7C3AED',
    pretext: '#### Fulcrum Commands',
    text: [
      '`/f` — Dashboard overview',
      '`/f tasks [doing|review|todo|done|high|#tag|@project]` — Task list',
      '`/f task <id>` — Task detail with actions',
      '`/f new <title>` — Create new task',
      '`/f deploy <app>` — App deployment',
      '`/f apps` — All applications',
      '`/f search <keywords>` — Search tasks & projects',
      '`/f monitor` — System resources',
      '`/f projects` — Project list',
    ].join('\n'),
  }
}

// --- Create Task Dialog ---

async function openCreateTaskDialog(triggerId: string, prefillTitle: string) {
  const allProjects = db.select().from(projects).where(eq(projects.status, 'active')).all()
  const allRepos = db.select().from(repositories).all()

  const dialog: MattermostDialog = {
    callback_id: 'create_task',
    title: 'Create Task',
    submit_label: 'Create',
    elements: [
      {
        display_name: 'Title',
        name: 'title',
        type: 'text',
        placeholder: 'Task title',
        default: prefillTitle || undefined,
      },
      {
        display_name: 'Description',
        name: 'description',
        type: 'textarea',
        optional: true,
        placeholder: 'What needs to be done?',
      },
      {
        display_name: 'Priority',
        name: 'priority',
        type: 'select',
        default: 'medium',
        options: [
          { text: '🔴 High', value: 'high' },
          { text: '🟡 Medium', value: 'medium' },
          { text: '🟢 Low', value: 'low' },
        ],
      },
      {
        display_name: 'Type',
        name: 'type',
        type: 'select',
        default: getSettings().tasks.defaultTaskType,
        options: [
          { text: 'Worktree (code task)', value: 'worktree' },
          { text: 'Scratch (isolated dir)', value: 'scratch' },
          { text: 'Manual (no directory)', value: 'manual' },
        ],
      },
      {
        display_name: 'Project',
        name: 'project_id',
        type: 'select',
        optional: true,
        options: [
          { text: '— None —', value: '' },
          ...allProjects.map(p => ({ text: p.name, value: p.id })),
        ],
      },
      {
        display_name: 'Repository',
        name: 'repository_id',
        type: 'select',
        optional: true,
        options: [
          { text: '— None —', value: '' },
          ...allRepos.slice(0, 20).map(r => ({ text: r.displayName || r.path.split('/').pop() || r.path, value: r.id })),
        ],
      },
      {
        display_name: 'Due Date (YYYY-MM-DD)',
        name: 'due_date',
        type: 'text',
        optional: true,
        placeholder: '2026-04-15',
      },
    ],
  }

  await openDialog(triggerId, dialog)
}

// --- Action Handler (button/select callbacks) ---

app.post('/actions', async (c) => {
  const body = await c.req.json()
  const context = body.context || {}
  const action = context.action as string
  const userId = body.user_id as string
  const postId = body.post_id as string
  const triggerId = body.trigger_id as string

  try {
    switch (action) {
      case 'list_tasks': {
        const filter: Record<string, string> = {}
        if (context.status) filter.status = context.status as string
        if (context.project_id) filter.projectId = context.project_id as string
        const card = await buildTaskListCard(filter)
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'task_detail': {
        const card = await buildTaskDetailCard(context.task_id as string)
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'status_change': {
        const taskId = context.task_id as string
        const newStatus = context.status as string
        await updateTaskStatus(taskId, newStatus)
        const card = await buildTaskDetailCard(taskId)
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'change_priority': {
        const taskId = context.task_id as string
        const newPriority = body.context?.selected_option || body.selected_option
        if (newPriority) {
          db.update(tasks).set({
            priority: newPriority,
            updatedAt: new Date().toISOString(),
          }).where(eq(tasks.id, taskId)).run()
        }
        const card = await buildTaskDetailCard(taskId)
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'list_apps': {
        const card = await buildAppsCard()
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'app_detail': {
        const card = await buildAppDetailCard(context.app_id as string)
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'deploy_app': {
        // Trigger deploy via internal API
        const appId = context.app_id as string
        try {
          const port = getSettings().server.port
          await fetch(`http://localhost:${port}/api/apps/${appId}/deploy`, { method: 'POST' })
          return c.json({ ephemeral_text: `🚀 Deployment triggered for app.` })
        } catch (err) {
          return c.json({ ephemeral_text: `❌ Deploy failed: ${err}` })
        }
      }

      case 'stop_app': {
        const appId = context.app_id as string
        try {
          const port = getSettings().server.port
          await fetch(`http://localhost:${port}/api/apps/${appId}/stop`, { method: 'POST' })
          return c.json({ ephemeral_text: `⏹ App stopped.` })
        } catch (err) {
          return c.json({ ephemeral_text: `❌ Stop failed: ${err}` })
        }
      }

      case 'app_logs': {
        const appId = context.app_id as string
        try {
          const port = getSettings().server.port
          const res = await fetch(`http://localhost:${port}/api/apps/${appId}/logs?tail=20`)
          const data = await res.json() as { logs: string }
          return c.json({
            update: {
              props: {
                attachments: [{
                  fallback: 'App Logs',
                  color: '#6B7280',
                  pretext: '#### 📋 App Logs (last 20 lines)',
                  text: `\`\`\`\n${data.logs?.slice(-2000) || 'No logs available'}\n\`\`\``,
                  actions: [
                    {
                      id: 'back',
                      name: '← Back',
                      type: 'button' as const,
                      integration: { url: getActionsUrl(), context: { action: 'app_detail', app_id: appId } },
                    },
                  ],
                }],
              },
            },
          })
        } catch {
          return c.json({ ephemeral_text: 'Failed to fetch logs.' })
        }
      }

      case 'monitor': {
        const card = await buildMonitorCard()
        return c.json({ update: { props: { attachments: [card] } } })
      }

      case 'open_create_task_dialog': {
        await openCreateTaskDialog(triggerId, '')
        return c.json({})
      }

      case 'open_link': {
        // Can't actually open a browser from Mattermost, return the link
        return c.json({ ephemeral_text: context.url as string })
      }

      default:
        return c.json({ ephemeral_text: `Unknown action: ${action}` })
    }
  } catch (err) {
    log.error('Mattermost action error', { action, error: String(err) })
    return c.json({ ephemeral_text: `Error: ${err instanceof Error ? err.message : String(err)}` })
  }
})

// --- Dialog Submission Handler ---

app.post('/dialogs', async (c) => {
  const body = await c.req.json()
  const callbackId = body.callback_id as string
  const submission = body.submission || {}
  const channelId = body.channel_id as string
  const userId = body.user_id as string

  try {
    switch (callbackId) {
      case 'create_task': {
        const title = submission.title as string
        if (!title) {
          return c.json({ errors: { title: 'Title is required' } })
        }

        const taskId = nanoid()
        const now = new Date().toISOString()

        // Get max position for ordering
        const maxPos = db.select().from(tasks).all()
          .reduce((max, t) => Math.max(max, t.position), 0)

        const taskType = submission.type === 'manual' ? null : (submission.type || null)

        db.insert(tasks).values({
          id: taskId,
          title,
          description: submission.description || null,
          status: 'TO_DO',
          position: maxPos + 1,
          priority: submission.priority || 'medium',
          type: taskType,
          projectId: submission.project_id || null,
          repositoryId: submission.repository_id || null,
          dueDate: submission.due_date || null,
          agent: 'claude',
          createdAt: now,
          updatedAt: now,
        }).run()

        // Post the new task card to the channel
        const config = getSettings().channels.mattermost
        const card = await buildTaskDetailCard(taskId)
        await postMessage({
          channel_id: channelId || config.channelId,
          props: { attachments: [card] },
        })

        return c.json(null) // null = success, no errors
      }

      default:
        return c.json({ errors: { '': `Unknown dialog: ${callbackId}` } })
    }
  } catch (err) {
    log.error('Mattermost dialog error', { callbackId, error: String(err) })
    return c.json({ errors: { '': `Error: ${err instanceof Error ? err.message : String(err)}` } })
  }
})

export default app
