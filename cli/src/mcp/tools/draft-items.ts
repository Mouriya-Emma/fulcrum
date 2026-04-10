/**
 * Draft item MCP tools
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'

export const registerDraftItemTools: ToolRegistrar = (server, client) => {
  server.tool(
    'list_draft_items',
    'List all checklist items for a draft task. Returns items ordered by position.',
    {
      taskId: z.string().describe('Draft task ID'),
    },
    async ({ taskId }) => {
      try {
        const items = await client.getDraftItems(taskId)
        return formatSuccess(items)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  server.tool(
    'create_draft_item',
    'Add a new checklist item to a draft task.',
    {
      taskId: z.string().describe('Draft task ID'),
      title: z.string().describe('Item title/description'),
      position: z.optional(z.number().int().min(0)).describe('Position in list (auto-appended if omitted)'),
    },
    async ({ taskId, title, position }) => {
      try {
        const item = await client.createDraftItem(taskId, { title, position })
        return formatSuccess(item)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  server.tool(
    'update_draft_item',
    'Update a draft checklist item (mark complete, rename, etc.).',
    {
      itemId: z.string().describe('Draft item ID'),
      title: z.optional(z.string()).describe('New title'),
      completed: z.optional(z.boolean()).describe('Mark as completed or not'),
    },
    async ({ itemId, title, completed }) => {
      try {
        const item = await client.updateDraftItem(itemId, { title, completed })
        return formatSuccess(item)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  server.tool(
    'delete_draft_item',
    'Remove a checklist item from a draft task.',
    {
      itemId: z.string().describe('Draft item ID'),
    },
    async ({ itemId }) => {
      try {
        const result = await client.deleteDraftItem(itemId)
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  server.tool(
    'sync_draft_to_issues',
    'Create GitHub issues for draft items that do not yet have one. Requires the draft task to be associated with a repository that has a GitHub remote.',
    {
      taskId: z.string().describe('Draft task ID'),
    },
    async ({ taskId }) => {
      try {
        const result = await client.syncDraftToIssues(taskId)
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )
}
