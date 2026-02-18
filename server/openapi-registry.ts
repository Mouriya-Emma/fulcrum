/**
 * Static OpenAPI route registration.
 *
 * Registers all existing API routes on the OpenAPIHono registry so they
 * appear in the spec immediately — even before individual route files are
 * migrated to createRoute() + Zod schemas.
 *
 * As each route file is migrated, remove its entries here. When this file
 * is empty, delete it.
 */
import type { OpenAPIHono } from '@hono/zod-openapi'

interface StaticRoute {
  method: string
  path: string
  operationId: string
  description: string
  queryParams?: string
  bodyFields?: string
}

interface StaticCategory {
  tag: string
  description: string
  routes: StaticRoute[]
}

// All routes that haven't been migrated to createRoute() + Zod yet.
// Remove entries from here as their route files are migrated.
const staticRoutes: StaticCategory[] = [
  {
    tag: 'tasks',
    description: 'Task management — CRUD, status, links, tags, dependencies, attachments',
    routes: [
      { method: 'GET', path: '/api/tasks', operationId: 'tasks-list', description: 'List all tasks', queryParams: 'search, tags, statuses, dueDateStart, dueDateEnd, overdue' },
      { method: 'POST', path: '/api/tasks', operationId: 'tasks-create', description: 'Create a task', bodyFields: 'title, type?, description?, status?, repoPath?, repoName?, baseBranch?, branch?, prefix?, worktreePath?, projectId?, repositoryId?, tags?, dueDate?, timeEstimate?, priority?, recurrenceRule?, recurrenceEndDate?' },
      { method: 'GET', path: '/api/tasks/{id}', operationId: 'tasks-get', description: 'Get task details' },
      { method: 'PATCH', path: '/api/tasks/{id}', operationId: 'tasks-update', description: 'Update task metadata', bodyFields: 'title?, description?, notes?, prUrl?, dueDate?, timeEstimate?, priority?, tags?, recurrenceRule?, recurrenceEndDate?' },
      { method: 'DELETE', path: '/api/tasks/{id}', operationId: 'tasks-delete', description: 'Delete a task', queryParams: 'deleteLinkedWorktree' },
      { method: 'PATCH', path: '/api/tasks/{id}/status', operationId: 'tasks-move', description: 'Move task to new status', bodyFields: 'status, position?' },
      { method: 'DELETE', path: '/api/tasks/bulk', operationId: 'tasks-bulk-delete', description: 'Bulk delete tasks', bodyFields: 'ids, deleteLinkedWorktrees?' },
      { method: 'GET', path: '/api/tasks/{id}/links', operationId: 'tasks-links', description: 'List task links' },
      { method: 'POST', path: '/api/tasks/{id}/links', operationId: 'tasks-add-link', description: 'Add link to task', bodyFields: 'url, label?' },
      { method: 'DELETE', path: '/api/tasks/{id}/links/{linkId}', operationId: 'tasks-rm-link', description: 'Remove link from task' },
      { method: 'POST', path: '/api/tasks/{id}/tags', operationId: 'tasks-add-tag', description: 'Add tag to task', bodyFields: 'tag' },
      { method: 'DELETE', path: '/api/tasks/{id}/tags/{tag}', operationId: 'tasks-rm-tag', description: 'Remove tag from task' },
      { method: 'PATCH', path: '/api/tasks/{id}/due-date', operationId: 'tasks-due-date', description: 'Set or clear due date', bodyFields: 'dueDate' },
      { method: 'GET', path: '/api/tasks/{id}/dependencies', operationId: 'tasks-deps', description: 'Get task dependencies' },
      { method: 'POST', path: '/api/tasks/{id}/dependencies', operationId: 'tasks-add-dep', description: 'Add dependency', bodyFields: 'dependsOnTaskId' },
      { method: 'DELETE', path: '/api/tasks/{id}/dependencies/{depId}', operationId: 'tasks-rm-dep', description: 'Remove dependency' },
      { method: 'GET', path: '/api/task-dependencies/graph', operationId: 'tasks-dep-graph', description: 'Get dependency graph (all tasks)' },
      { method: 'GET', path: '/api/tasks/{id}/attachments', operationId: 'tasks-attachments', description: 'List task attachments' },
      { method: 'POST', path: '/api/tasks/{id}/attachments', operationId: 'tasks-upload', description: 'Upload attachment (multipart)' },
      { method: 'DELETE', path: '/api/tasks/{id}/attachments/{attachmentId}', operationId: 'tasks-rm-attachment', description: 'Delete attachment' },
      { method: 'GET', path: '/api/tags', operationId: 'tasks-list-tags', description: 'List all tags with usage counts' },
      { method: 'DELETE', path: '/api/tags/{id}', operationId: 'tasks-delete-tag', description: 'Delete a tag' },
    ],
  },
  {
    tag: 'projects',
    description: 'Project management — CRUD, tags, attachments, links',
    routes: [
      { method: 'GET', path: '/api/projects', operationId: 'projects-list', description: 'List all projects' },
      { method: 'POST', path: '/api/projects', operationId: 'projects-create', description: 'Create project', bodyFields: 'name, description?, repositoryId?, path?, url?, targetDir?, folderName?' },
      { method: 'GET', path: '/api/projects/{id}', operationId: 'projects-get', description: 'Get project details' },
      { method: 'PATCH', path: '/api/projects/{id}', operationId: 'projects-update', description: 'Update project', bodyFields: 'name?, description?, notes?, status?' },
      { method: 'DELETE', path: '/api/projects/{id}', operationId: 'projects-delete', description: 'Delete project', queryParams: 'deleteDirectory, deleteApp' },
      { method: 'POST', path: '/api/projects/scan', operationId: 'projects-scan', description: 'Scan directory for repos', bodyFields: 'directory?' },
      { method: 'POST', path: '/api/projects/bulk', operationId: 'projects-bulk-create', description: 'Bulk create from repos', bodyFields: 'repositories' },
      { method: 'POST', path: '/api/projects/{id}/tags', operationId: 'projects-add-tag', description: 'Add tag to project', bodyFields: 'tagId? or name?' },
      { method: 'DELETE', path: '/api/projects/{id}/tags/{tagId}', operationId: 'projects-rm-tag', description: 'Remove tag from project' },
      { method: 'GET', path: '/api/projects/{id}/attachments', operationId: 'projects-attachments', description: 'List project attachments' },
      { method: 'POST', path: '/api/projects/{id}/attachments', operationId: 'projects-upload', description: 'Upload attachment (multipart)' },
      { method: 'DELETE', path: '/api/projects/{id}/attachments/{attachmentId}', operationId: 'projects-rm-attachment', description: 'Delete attachment' },
      { method: 'GET', path: '/api/projects/{id}/links', operationId: 'projects-links', description: 'List project links' },
      { method: 'POST', path: '/api/projects/{id}/links', operationId: 'projects-add-link', description: 'Add link', bodyFields: 'url, label?' },
      { method: 'DELETE', path: '/api/projects/{id}/links/{linkId}', operationId: 'projects-rm-link', description: 'Remove link' },
    ],
  },
  {
    tag: 'repositories',
    description: 'Repository management — add, configure, link to projects',
    routes: [
      { method: 'GET', path: '/api/repositories', operationId: 'repositories-list', description: 'List repositories', queryParams: 'orphans, projectId' },
      { method: 'POST', path: '/api/repositories', operationId: 'repositories-create', description: 'Add repository', bodyFields: 'path, displayName?, projectId?' },
      { method: 'GET', path: '/api/repositories/{id}', operationId: 'repositories-get', description: 'Get repository details' },
      { method: 'PATCH', path: '/api/repositories/{id}', operationId: 'repositories-update', description: 'Update repository', bodyFields: 'displayName?, startupScript?, copyFiles?, defaultAgent?, claudeOptions?, opencodeOptions?, opencodeModel?' },
      { method: 'DELETE', path: '/api/repositories/{id}', operationId: 'repositories-delete', description: 'Delete repository (must be orphaned)' },
      { method: 'POST', path: '/api/projects/{projectId}/repositories', operationId: 'repositories-link', description: 'Link repo to project', bodyFields: 'repositoryId, isPrimary?, moveFromProject?' },
      { method: 'DELETE', path: '/api/projects/{projectId}/repositories/{repoId}', operationId: 'repositories-unlink', description: 'Unlink repo from project' },
    ],
  },
  {
    tag: 'apps',
    description: 'Docker Compose app deployment — deploy, stop, monitor',
    routes: [
      { method: 'GET', path: '/api/apps', operationId: 'apps-list', description: 'List all apps' },
      { method: 'POST', path: '/api/apps', operationId: 'apps-create', description: 'Create app', bodyFields: 'name, repositoryId, branch?, composeFile?, autoDeployEnabled?, environmentVariables?, noCacheBuild?, services?' },
      { method: 'GET', path: '/api/apps/{id}', operationId: 'apps-get', description: 'Get app details' },
      { method: 'PATCH', path: '/api/apps/{id}', operationId: 'apps-update', description: 'Update app', bodyFields: 'name?, branch?, autoDeployEnabled?, environmentVariables?, noCacheBuild?, services?' },
      { method: 'DELETE', path: '/api/apps/{id}', operationId: 'apps-delete', description: 'Delete app', queryParams: 'stopContainers' },
      { method: 'POST', path: '/api/apps/{id}/deploy', operationId: 'apps-deploy', description: 'Trigger deployment' },
      { method: 'POST', path: '/api/apps/{id}/stop', operationId: 'apps-stop', description: 'Stop running app' },
      { method: 'GET', path: '/api/apps/{id}/logs', operationId: 'apps-logs', description: 'Get container logs', queryParams: 'service, tail' },
      { method: 'GET', path: '/api/apps/{id}/status', operationId: 'apps-status', description: 'Get container status' },
      { method: 'GET', path: '/api/apps/{id}/deployments', operationId: 'apps-deployments', description: 'Deployment history' },
      { method: 'POST', path: '/api/apps/{id}/sync-services', operationId: 'apps-sync-services', description: 'Sync services from compose file' },
    ],
  },
  {
    tag: 'config',
    description: 'Configuration and settings',
    routes: [
      { method: 'GET', path: '/api/config', operationId: 'config-list', description: 'List all config values' },
      { method: 'GET', path: '/api/config/{key}', operationId: 'config-get', description: 'Get config value' },
      { method: 'PUT', path: '/api/config/{key}', operationId: 'config-set', description: 'Set config value', bodyFields: 'value' },
      { method: 'DELETE', path: '/api/config/{key}', operationId: 'config-reset', description: 'Reset config to default' },
      { method: 'GET', path: '/api/config/notifications', operationId: 'config-notifications', description: 'Get notification settings' },
      { method: 'PUT', path: '/api/config/notifications', operationId: 'config-update-notifications', description: 'Update notification settings' },
      { method: 'POST', path: '/api/config/notifications/test/{channel}', operationId: 'config-test-notification', description: 'Test notification channel' },
      { method: 'POST', path: '/api/config/notifications/send', operationId: 'config-send-notification', description: 'Send notification', bodyFields: 'title, message' },
      { method: 'GET', path: '/api/config/developer-mode', operationId: 'config-developer-mode', description: 'Get developer mode status' },
      { method: 'POST', path: '/api/config/restart', operationId: 'config-restart', description: 'Restart Fulcrum server' },
    ],
  },
  {
    tag: 'notifications',
    description: 'Notification delivery (alias for config/notifications)',
    routes: [
      { method: 'POST', path: '/api/config/notifications/send', operationId: 'notifications-send', description: 'Send notification to all enabled channels', bodyFields: 'title, message' },
      { method: 'POST', path: '/api/config/notifications/test/{channel}', operationId: 'notifications-test', description: 'Test a channel (sound, slack, discord, pushover, whatsapp, telegram, gmail)' },
    ],
  },
  {
    tag: 'caldav',
    description: 'Calendar integration — accounts, calendars, events, copy rules',
    routes: [
      { method: 'GET', path: '/api/caldav/status', operationId: 'caldav-status', description: 'Get CalDAV sync status' },
      { method: 'GET', path: '/api/caldav/accounts', operationId: 'caldav-accounts', description: 'List CalDAV accounts' },
      { method: 'POST', path: '/api/caldav/accounts', operationId: 'caldav-create-account', description: 'Create CalDAV account', bodyFields: 'name, serverUrl, username, password, syncIntervalMinutes?' },
      { method: 'DELETE', path: '/api/caldav/accounts/{id}', operationId: 'caldav-delete-account', description: 'Delete CalDAV account' },
      { method: 'POST', path: '/api/caldav/accounts/{id}/sync', operationId: 'caldav-sync-account', description: 'Sync CalDAV account' },
      { method: 'GET', path: '/api/caldav/calendars', operationId: 'caldav-calendars', description: 'List calendars', queryParams: 'accountId' },
      { method: 'POST', path: '/api/caldav/sync', operationId: 'caldav-sync', description: 'Sync all calendars' },
      { method: 'GET', path: '/api/caldav/events', operationId: 'caldav-events', description: 'List events', queryParams: 'calendarId, from, to, limit' },
      { method: 'GET', path: '/api/caldav/events/{id}', operationId: 'caldav-get-event', description: 'Get event details' },
      { method: 'POST', path: '/api/caldav/events', operationId: 'caldav-create-event', description: 'Create event', bodyFields: 'calendarId, summary, dtstart, dtend?, duration?, description?, location?, allDay?, recurrenceRule?, status?' },
      { method: 'PATCH', path: '/api/caldav/events/{id}', operationId: 'caldav-update-event', description: 'Update event', bodyFields: 'summary?, dtstart?, dtend?, duration?, description?, location?, allDay?, recurrenceRule?, status?' },
      { method: 'DELETE', path: '/api/caldav/events/{id}', operationId: 'caldav-delete-event', description: 'Delete event' },
      { method: 'GET', path: '/api/caldav/copy-rules', operationId: 'caldav-copy-rules', description: 'List copy rules' },
      { method: 'POST', path: '/api/caldav/copy-rules', operationId: 'caldav-create-copy-rule', description: 'Create copy rule', bodyFields: 'name?, sourceCalendarId, destCalendarId' },
      { method: 'DELETE', path: '/api/caldav/copy-rules/{id}', operationId: 'caldav-delete-copy-rule', description: 'Delete copy rule' },
      { method: 'POST', path: '/api/caldav/copy-rules/{id}/execute', operationId: 'caldav-execute-copy-rule', description: 'Execute copy rule' },
    ],
  },
  {
    tag: 'email',
    description: 'Email management — list, search, fetch emails',
    routes: [
      { method: 'GET', path: '/api/messaging/email/emails', operationId: 'email-list', description: 'List emails', queryParams: 'limit, offset, direction, threadId, search, folder' },
      { method: 'GET', path: '/api/messaging/email/emails/{id}', operationId: 'email-get', description: 'Get email by ID' },
      { method: 'POST', path: '/api/messaging/email/search', operationId: 'email-search', description: 'Search emails (IMAP)', bodyFields: 'subject?, from?, to?, since?, before?, text?, seen?, flagged?, fetchLimit?' },
      { method: 'POST', path: '/api/messaging/email/fetch', operationId: 'email-fetch', description: 'Fetch emails by UID', bodyFields: 'uids, limit?' },
    ],
  },
  {
    tag: 'messaging',
    description: 'Send messages via WhatsApp, Discord, Telegram, Slack',
    routes: [
      { method: 'POST', path: '/api/messaging/send', operationId: 'messaging-send', description: 'Send message', bodyFields: 'channel, body, subject?, replyToMessageId?, slackBlocks?, filePath?' },
      { method: 'GET', path: '/api/messaging/messages/{id}', operationId: 'messaging-get', description: 'Get message by ID' },
    ],
  },
  {
    tag: 'google',
    description: 'Google accounts, Gmail drafts, sending',
    routes: [
      { method: 'GET', path: '/api/google/accounts', operationId: 'google-list', description: 'List Google accounts' },
      { method: 'GET', path: '/api/google/accounts/{id}', operationId: 'google-get', description: 'Get Google account' },
      { method: 'DELETE', path: '/api/google/accounts/{id}', operationId: 'google-delete', description: 'Delete Google account' },
      { method: 'POST', path: '/api/google/accounts/{id}/enable-calendar', operationId: 'google-enable-calendar', description: 'Enable Google Calendar' },
      { method: 'POST', path: '/api/google/accounts/{id}/disable-calendar', operationId: 'google-disable-calendar', description: 'Disable Google Calendar' },
      { method: 'POST', path: '/api/google/accounts/{id}/enable-gmail', operationId: 'google-enable-gmail', description: 'Enable Gmail' },
      { method: 'POST', path: '/api/google/accounts/{id}/disable-gmail', operationId: 'google-disable-gmail', description: 'Disable Gmail' },
      { method: 'POST', path: '/api/google/accounts/{id}/sync', operationId: 'google-sync', description: 'Sync Google Calendar' },
      { method: 'GET', path: '/api/google/accounts/{id}/drafts', operationId: 'google-drafts', description: 'List Gmail drafts' },
      { method: 'POST', path: '/api/google/accounts/{id}/drafts', operationId: 'google-create-draft', description: 'Create Gmail draft', bodyFields: 'to?, cc?, bcc?, subject?, body?, htmlBody?' },
      { method: 'PATCH', path: '/api/google/accounts/{id}/drafts/{draftId}', operationId: 'google-update-draft', description: 'Update Gmail draft', bodyFields: 'to?, cc?, bcc?, subject?, body?, htmlBody?' },
      { method: 'DELETE', path: '/api/google/accounts/{id}/drafts/{draftId}', operationId: 'google-delete-draft', description: 'Delete Gmail draft' },
      { method: 'POST', path: '/api/google/accounts/{id}/send', operationId: 'google-send', description: 'Send email via Gmail', bodyFields: 'body, subject?' },
    ],
  },
  {
    tag: 'jobs',
    description: 'Systemd/launchd timer management',
    routes: [
      { method: 'GET', path: '/api/jobs', operationId: 'jobs-list', description: 'List jobs', queryParams: 'scope' },
      { method: 'POST', path: '/api/jobs', operationId: 'jobs-create', description: 'Create job' },
      { method: 'GET', path: '/api/jobs/{name}', operationId: 'jobs-get', description: 'Get job details', queryParams: 'scope' },
      { method: 'PATCH', path: '/api/jobs/{name}', operationId: 'jobs-update', description: 'Update job' },
      { method: 'DELETE', path: '/api/jobs/{name}', operationId: 'jobs-delete', description: 'Delete job' },
      { method: 'GET', path: '/api/jobs/{name}/logs', operationId: 'jobs-logs', description: 'Get job logs', queryParams: 'scope, lines' },
      { method: 'POST', path: '/api/jobs/{name}/enable', operationId: 'jobs-enable', description: 'Enable job', queryParams: 'scope' },
      { method: 'POST', path: '/api/jobs/{name}/disable', operationId: 'jobs-disable', description: 'Disable job', queryParams: 'scope' },
      { method: 'POST', path: '/api/jobs/{name}/run', operationId: 'jobs-run', description: 'Run job now', queryParams: 'scope' },
    ],
  },
  {
    tag: 'filesystem',
    description: 'Remote filesystem operations',
    routes: [
      { method: 'GET', path: '/api/fs/list', operationId: 'filesystem-list', description: 'List directory', queryParams: 'path' },
      { method: 'GET', path: '/api/fs/tree', operationId: 'filesystem-tree', description: 'Get file tree', queryParams: 'root' },
      { method: 'GET', path: '/api/fs/read', operationId: 'filesystem-read', description: 'Read file', queryParams: 'path, root, maxLines' },
      { method: 'POST', path: '/api/fs/write', operationId: 'filesystem-write', description: 'Write file', bodyFields: 'path, root, content' },
      { method: 'POST', path: '/api/fs/edit', operationId: 'filesystem-edit', description: 'Edit file (find/replace)', bodyFields: 'path, root, old_string, new_string' },
      { method: 'GET', path: '/api/fs/file-stat', operationId: 'filesystem-file-stat', description: 'Get file metadata', queryParams: 'path, root' },
      { method: 'GET', path: '/api/fs/stat', operationId: 'filesystem-stat', description: 'Get path info', queryParams: 'path' },
      { method: 'GET', path: '/api/fs/is-git-repo', operationId: 'filesystem-is-git-repo', description: 'Check if path is git repo', queryParams: 'path' },
    ],
  },
  {
    tag: 'exec',
    description: 'Shell command execution with persistent sessions',
    routes: [
      { method: 'POST', path: '/api/exec', operationId: 'exec-run', description: 'Execute command', bodyFields: 'command, sessionId?, cwd?, timeout?, name?' },
      { method: 'GET', path: '/api/exec/sessions', operationId: 'exec-sessions', description: 'List active sessions' },
      { method: 'PATCH', path: '/api/exec/sessions/{id}', operationId: 'exec-rename-session', description: 'Rename session', bodyFields: 'name' },
      { method: 'DELETE', path: '/api/exec/sessions/{id}', operationId: 'exec-destroy-session', description: 'Destroy session' },
    ],
  },
  {
    tag: 'git',
    description: 'Git operations — branches, diff, status, worktrees',
    routes: [
      { method: 'GET', path: '/api/git/branches', operationId: 'git-branches', description: 'List branches', queryParams: 'repo' },
      { method: 'GET', path: '/api/git/diff', operationId: 'git-diff', description: 'Get diff', queryParams: 'path, staged, ignoreWhitespace, includeUntracked' },
      { method: 'GET', path: '/api/git/status', operationId: 'git-status', description: 'Get status', queryParams: 'path' },
      { method: 'GET', path: '/api/worktrees', operationId: 'git-worktrees', description: 'List worktrees' },
      { method: 'DELETE', path: '/api/worktrees', operationId: 'git-delete-worktree', description: 'Delete worktree', bodyFields: 'worktreePath, repoPath?, deleteLinkedTask?' },
    ],
  },
  {
    tag: 'assistant',
    description: 'AI assistant — sweep runs',
    routes: [
      { method: 'GET', path: '/api/assistant/sweeps', operationId: 'assistant-sweeps', description: 'List sweep runs', queryParams: 'type, limit' },
      { method: 'GET', path: '/api/assistant/sweeps/{id}', operationId: 'assistant-get-sweep', description: 'Get sweep run' },
      { method: 'GET', path: '/api/assistant/sweeps/last/{type}', operationId: 'assistant-last-sweep', description: 'Get last sweep run by type' },
    ],
  },
]

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Tag definitions for the OpenAPI spec. Used by app.doc31() config.
 *  Includes both static (not yet migrated) and migrated route tags. */
export const tagDefinitions = [
  ...staticRoutes.map((cat) => ({
    name: cat.tag,
    description: cat.description,
  })),
  // Tags for migrated routes (remove from here when the file is deleted)
  { name: 'memory', description: 'Agent memory — persistent knowledge store' },
  { name: 'search', description: 'Unified full-text search across all entities' },
  { name: 'backup', description: 'Database and settings backup/restore' },
]

export function registerStaticRoutes(app: OpenAPIHono) {
  for (const cat of staticRoutes) {
    for (const route of cat.routes) {
      const method = route.method.toLowerCase() as HttpMethod

      // Build raw OpenAPI parameters array
      const parameters: Array<Record<string, unknown>> = []

      // Path parameters from {param} patterns
      const pathParamMatches = route.path.match(/\{(\w+)\}/g)
      if (pathParamMatches) {
        for (const match of pathParamMatches) {
          parameters.push({
            name: match.slice(1, -1),
            in: 'path',
            required: true,
            schema: { type: 'string' },
          })
        }
      }

      // Query parameters from comma-separated string
      if (route.queryParams) {
        for (const name of route.queryParams.split(',').map((p) => p.trim())) {
          parameters.push({
            name,
            in: 'query',
            schema: { type: 'string' },
          })
        }
      }

      // Build the registration object
      const entry: Record<string, unknown> = {
        method,
        path: route.path,
        operationId: route.operationId,
        summary: route.description,
        tags: [cat.tag],
        responses: { 200: { description: 'Success' } },
      }

      if (parameters.length > 0) {
        entry.parameters = parameters
      }

      // Body fields as description-only requestBody
      if (route.bodyFields) {
        entry.requestBody = {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: `Fields: ${route.bodyFields}`,
              },
            },
          },
        }
      }

      app.openAPIRegistry.registerPath(
        entry as Parameters<typeof app.openAPIRegistry.registerPath>[0]
      )
    }
  }
}
