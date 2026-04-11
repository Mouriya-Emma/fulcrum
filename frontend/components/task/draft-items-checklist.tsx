import { useState, useRef, useEffect, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, ArrowUp01Icon, ArrowDown01Icon, Link01Icon, GithubIcon, Menu09Icon } from '@hugeicons/core-free-icons'
import {
  useDraftItems,
  useCreateDraftItem,
  useUpdateDraftItem,
  useDeleteDraftItem,
  useReorderDraftItems,
  useSyncDraftToIssues,
  useBatchUpdateDraftItems,
  useDownstreamTasks,
  type DraftItem,
} from '@/hooks/use-draft-items'
import { cn } from '@/lib/utils'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'

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
  const batchUpdate = useBatchUpdateDraftItems()
  const { data: downstreamTasks = [] } = useDownstreamTasks(taskId)

  const [newItemTitle, setNewItemTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)
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

  const handleDelete = (item: DraftItem) => {
    if (item.issueUrl) {
      setConfirmDeleteId(item.id)
    } else {
      deleteItem.mutate({ itemId: item.id, taskId })
    }
  }

  const handleConfirmDelete = (itemId: string) => {
    deleteItem.mutate({ itemId, taskId })
    setConfirmDeleteId(null)
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

  const handleCheckAll = () => {
    const unchecked = items.filter((i) => !i.completed)
    if (unchecked.length === 0) return
    batchUpdate.mutate({
      taskId,
      items: unchecked.map((i) => ({ id: i.id, completed: true })),
    })
  }

  const handleUncheckAll = () => {
    const checked = items.filter((i) => i.completed)
    if (checked.length === 0) return
    batchUpdate.mutate({
      taskId,
      items: checked.map((i) => ({ id: i.id, completed: false })),
    })
  }

  const handleClearCompleted = () => {
    const completed = items.filter((i) => i.completed)
    for (const item of completed) {
      deleteItem.mutate({ itemId: item.id, taskId })
    }
  }

  const handleSync = () => {
    setSyncProgress('Starting...')
    syncToIssues.mutate(taskId, {
      onSuccess: (data) => {
        if (data.created > 0) {
          setSyncProgress(`Created ${data.created} issue${data.created > 1 ? 's' : ''}`)
        }
        if (data.errors?.length > 0) {
          setSyncProgress(`${data.created} created, ${data.errors.length} failed`)
        }
        setTimeout(() => setSyncProgress(null), 3000)
      },
      onError: () => {
        setSyncProgress('Sync failed')
        setTimeout(() => setSyncProgress(null), 3000)
      },
    })
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit()
    if (e.key === 'Escape') setEditingId(null)
    if (e.key === 'Tab') {
      e.preventDefault()
      handleSaveEdit()
      // Focus next item for editing
      const currentIndex = items.findIndex((i) => i.id === editingId)
      const nextItem = items[currentIndex + 1]
      if (nextItem) {
        setEditingId(nextItem.id)
        setEditingTitle(nextItem.title)
      }
    }
  }

  const completedCount = items.filter((i) => i.completed).length
  const unsyncedCount = items.filter((i) => !i.issueUrl).length

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-3">
      {/* Progress + batch ops */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {completedCount}/{items.length} completed
        </span>
        <div className="flex gap-1">
          {items.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleCheckAll} disabled={completedCount === items.length}>
                Check All
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleUncheckAll} disabled={completedCount === 0}>
                Uncheck All
              </Button>
              {completedCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive" onClick={handleClearCompleted}>
                  Clear Done
                </Button>
              )}
            </>
          )}
          {hasRepo && unsyncedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncToIssues.isPending}
              className="h-6 text-xs"
            >
              <HugeiconsIcon icon={GithubIcon} size={12} className="mr-1" />
              {syncProgress || (syncToIssues.isPending ? 'Syncing...' : `Sync ${unsyncedCount} to Issues`)}
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-2">
          No items yet. Add your first checklist item below.
        </p>
      )}

      {/* Items list */}
      <div className="space-y-0.5">
        {items.map((item, index) => (
          <DraftItemRow
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            isEditing={editingId === item.id}
            editingTitle={editingTitle}
            confirmDeleteId={confirmDeleteId}
            onToggle={handleToggle}
            onStartEdit={handleStartEdit}
            onEditChange={setEditingTitle}
            onEditKeyDown={handleEditKeyDown}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDelete={handleDelete}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            allItems={items}
            taskId={taskId}
            onReorder={(ids) => reorderItems.mutate({ taskId, itemIds: ids })}
          />
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
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
        <div className="text-xs text-destructive space-y-0.5">
          {syncToIssues.data.errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* Downstream tasks using this draft */}
      {downstreamTasks.length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-xs text-muted-foreground">Used by</span>
          <div className="mt-1 space-y-0.5">
            {downstreamTasks.map((t) => (
              <a key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-2 text-xs hover:text-primary py-0.5">
                <span className={cn(
                  'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  t.status === 'IN_PROGRESS' ? 'bg-status-in-progress/20 text-status-in-progress' :
                  t.status === 'IN_REVIEW' ? 'bg-status-in-review/20 text-status-in-review' :
                  t.status === 'DONE' ? 'bg-status-done/20 text-status-done' :
                  'bg-status-todo/20 text-status-todo'
                )}>
                  {t.status.replace('_', ' ')}
                </span>
                <span>{t.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DraftItemRowProps {
  item: DraftItem
  index: number
  total: number
  isEditing: boolean
  editingTitle: string
  confirmDeleteId: string | null
  onToggle: (item: DraftItem) => void
  onStartEdit: (item: DraftItem) => void
  onEditChange: (value: string) => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (item: DraftItem) => void
  onConfirmDelete: (itemId: string) => void
  onCancelDelete: () => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  allItems: DraftItem[]
  taskId: string
  onReorder: (ids: string[]) => void
}

function DraftItemRow({
  item,
  index,
  total,
  isEditing,
  editingTitle,
  confirmDeleteId,
  onToggle,
  onStartEdit,
  onEditChange,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onMoveUp,
  onMoveDown,
  allItems,
  onReorder,
}: DraftItemRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverState, setDragOverState] = useState<'top' | 'bottom' | null>(null)

  useEffect(() => {
    const el = rowRef.current
    const handle = dragHandleRef.current
    if (!el || !handle) return

    const cleanupDrag = draggable({
      element: el,
      dragHandle: handle,
      getInitialData: () => ({ itemId: item.id, index }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })

    const cleanupDrop = dropTargetForElements({
      element: el,
      getData: () => ({ itemId: item.id, index }),
      canDrop: ({ source }) => source.data.itemId !== item.id,
      onDragEnter: ({ self, source }) => {
        const sourceIndex = source.data.index as number
        setDragOverState(sourceIndex < index ? 'bottom' : 'top')
      },
      onDragLeave: () => setDragOverState(null),
      onDrop: ({ source }) => {
        setDragOverState(null)
        const sourceIndex = source.data.index as number
        const ids = allItems.map((i) => i.id)
        const [removed] = ids.splice(sourceIndex, 1)
        ids.splice(index, 0, removed)
        onReorder(ids)
      },
    })

    return () => {
      cleanupDrag()
      cleanupDrop()
    }
  }, [item.id, index, allItems, onReorder])

  const isConfirmingDelete = confirmDeleteId === item.id

  return (
    <div
      ref={rowRef}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors',
        item.completed && 'opacity-60',
        isDragging && 'opacity-30',
        dragOverState === 'top' && 'border-t-2 border-primary',
        dragOverState === 'bottom' && 'border-b-2 border-primary',
      )}
    >
      {/* Drag handle */}
      <div ref={dragHandleRef} className="shrink-0 cursor-grab opacity-0 group-hover:opacity-60 transition-opacity" aria-label="Drag to reorder">
        <HugeiconsIcon icon={Menu09Icon} size={14} />
      </div>

      <Checkbox
        checked={item.completed}
        onCheckedChange={() => onToggle(item)}
        className="shrink-0"
      />
      {isEditing ? (
        <Input
          value={editingTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={onEditKeyDown}
          autoFocus
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span
          className={cn(
            'flex-1 text-sm cursor-pointer',
            item.completed && 'line-through text-muted-foreground',
          )}
          onClick={() => onStartEdit(item)}
        >
          {item.title}
          {item.notes && (
            <span className="ml-2 text-xs text-muted-foreground italic">— {item.notes}</span>
          )}
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
      {isConfirmingDelete ? (
        <div className="shrink-0 flex items-center gap-1">
          <span className="text-xs text-destructive">Delete?</span>
          <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => onConfirmDelete(item.id)}>
            Yes
          </Button>
          <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={onCancelDelete}>
            No
          </Button>
        </div>
      ) : (
        <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveUp(index)}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === 0}
            aria-label="Move up"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={12} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index >= total - 1}
            aria-label="Move down"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="p-0.5 text-muted-foreground hover:text-destructive"
            aria-label="Delete item"
          >
            <HugeiconsIcon icon={Delete02Icon} size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
