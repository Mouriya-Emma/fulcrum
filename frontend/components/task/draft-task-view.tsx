import { TaskContent } from '@/components/task/task-content'
import type { Task } from '@/types'

interface DraftTaskViewProps {
  task: Task
}

export function DraftTaskView({ task }: DraftTaskViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TaskContent task={task} />
    </div>
  )
}
