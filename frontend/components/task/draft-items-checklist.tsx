import { useState, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, ArrowUp01Icon, ArrowDown01Icon, Link01Icon, GithubIcon } from '@hugeicons/core-free-icons'
import {
  useDraftItems,
  useCreateDraftItem,
  useUpdateDraftItem,
  useDeleteDraftItem,
  useReorderDraftItems,
  useSyncDraftToIssues,
  type DraftItem,
} from '@/hooks/use-draft-items'
import { cn } from '@/lib/utils'

interface DraftItemsChecklistProps {
  taskId: string
  hasRepo?: boolean
}

export function DraftItemsChecklist({ taskId, hasRepo }: DraftItemsChecklistProps) {
  const { data: items = [], isLoading } = useDraftItems(taskId)
  const createItem = useCreateDraftItem()
  const updateItem = useUpdateDraftItem()
  const deleteItem = useDeleteDraftItem()
  const reorderItems = useReorderDraftItems()
  const syncToIssues = useSyncDraftToIssues()

  const [newItemTitle, setNewItemTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    if (!newItemTitle.trim()) return
    createItem.mutate({ taskId, title: newItemTitle.trim() })
    setNewItemTitle('')
    inputRef.current?.focus()
  }

  const handleToggle = (item: DraftItem) => {
    updateItem.mutate({ itemId: item.id, taskId, completed: !item.completed })
  }

  const handleStartEdit = (item: DraftItem) => {
    setEditingId(item.id)
    setEditingTitle(item.title)
  }

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      updateItem.mutate({ itemId: editingId, taskId, title: editingTitle.trim() })
    }
    setEditingId(null)
  }

  const handleDelete = (itemId: string) => {
    deleteItem.mutate({ itemId, taskId })
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const ids = items.map((i) => i.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    reorderItems.mutate({ taskId, itemIds: ids })
  }

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return
    const ids = items.map((i) => i.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    reorderItems.mutate({ taskId, itemIds: ids })
  }

  const completedCount = items.filter((i) => i.completed).length
  const unsyncedCount = items.filter((i) => !i.issueUrl).length

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading...</div>
  }

  return (
    <div className="space-y-2">
      {/* Progress + sync */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {completedCount}/{items.length} completed
        </span>
        {hasRepo && unsyncedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncToIssues.mutate(taskId)}
            disabled={syncToIssues.isPending}
            className="h-7 text-xs"
          >
            <HugeiconsIcon icon={GithubIcon} size={14} className="mr-1" />
            {syncToIssues.isPending ? 'Syncing...' : `Sync ${unsyncedCount} to Issues`}
          </Button>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-0.5">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50',
              item.completed && 'opacity-60',
            )}
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => handleToggle(item)}
              className="shrink-0"
            />
            {editingId === item.id ? (
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                className="h-7 text-sm flex-1"
              />
            ) : (
              <span
                className={cn(
                  'flex-1 text-sm cursor-pointer',
                  item.completed && 'line-through text-muted-foreground',
                )}
                onClick={() => handleStartEdit(item)}
              >
                {item.title}
              </span>
            )}
            {item.issueUrl && (
              <a
                href={item.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title={`Issue #${item.issueNumber}`}
              >
                <HugeiconsIcon icon={Link01Icon} size={14} />
              </a>
            )}
            <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleMoveUp(index)}
                className="p-0.5 text-muted-foreground hover:text-foreground"
                disabled={index === 0}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
              </button>
              <button
                onClick={() => handleMoveDown(index)}
                className="p-0.5 text-muted-foreground hover:text-foreground"
                disabled={index >= items.length - 1}
              >
                <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-0.5 text-muted-foreground hover:text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2 px-2">
        <Input
          ref={inputRef}
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
          }}
          placeholder="Add item..."
          className="h-8 text-sm flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!newItemTitle.trim() || createItem.isPending}
          className="h-8"
        >
          Add
        </Button>
      </div>

      {/* Sync errors */}
      {syncToIssues.data?.errors && syncToIssues.data.errors.length > 0 && (
        <div className="text-xs text-destructive px-2">
          {syncToIssues.data.errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}
    </div>
  )
}
