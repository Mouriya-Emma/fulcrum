import { TaskContent } from '@/components/task/task-content'
import { DraftItemsChecklist } from '@/components/task/draft-items-checklist'
import type { Task } from '@/types'

interface DraftTaskViewProps {
  task: Task
}

export function DraftTaskView({ task }: DraftTaskViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          <DraftItemsChecklist taskId={task.id} hasRepo={!!task.repositoryId} />
        </div>
        <TaskContent task={task} />
      </div>
    </div>
  )
}
