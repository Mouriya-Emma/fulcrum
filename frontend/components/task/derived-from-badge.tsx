import { Link } from '@tanstack/react-router'
import { useTask } from '@/hooks/use-tasks'

interface DerivedFromBadgeProps {
  taskId: string
}

export function DerivedFromBadge({ taskId }: DerivedFromBadgeProps) {
  const { data: parentTask } = useTask(taskId)

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-purple-600 dark:text-purple-400 font-medium">Derived from:</span>
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="truncate text-purple-600 dark:text-purple-400 hover:underline"
        >
          {parentTask?.title ?? taskId}
        </Link>
      </div>
    </div>
  )
}
