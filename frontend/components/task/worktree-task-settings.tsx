import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useInitializeScratchTask } from '@/hooks/use-tasks'
import { useDefaultAgent } from '@/hooks/use-config'
import type { Task } from '@/types'
import { InitializeWorktreeTaskModal } from './initialize-worktree-task-modal'

interface WorktreeTaskSettingsProps {
  task: Task
  compact?: boolean
}

export function WorktreeTaskSettings({ task, compact }: WorktreeTaskSettingsProps) {
  const navigate = useNavigate()
  const { data: defaultAgent } = useDefaultAgent()
  const initializeScratch = useInitializeScratchTask()
  const [initializeModalOpen, setInitializeModalOpen] = useState(false)

  const handleInitializeScratch = () => {
    initializeScratch.mutate(
      { taskId: task.id, agent: defaultAgent || 'claude' },
      {
        onSuccess: (data) => {
          if (data) {
            navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
          }
        },
      }
    )
  }

  const paddingClass = compact ? 'p-3' : 'p-4'
  const marginClass = compact ? 'mb-2' : 'mb-3'
  const headingClass = compact ? 'text-xs' : 'text-sm'

  // Uninitialized scratch task — show initialize button directly
  if (task.type === 'scratch') {
    return (
      <div className={`rounded-lg border bg-card ${paddingClass}`}>
        <h2 className={`${headingClass} font-medium text-muted-foreground ${marginClass}`}>Scratch Task</h2>
        <Button
          variant="outline"
          onClick={handleInitializeScratch}
          disabled={initializeScratch.isPending}
          className="w-full"
          size={compact ? 'sm' : 'default'}
        >
          {initializeScratch.isPending ? 'Creating...' : 'Initialize Scratch Task'}
        </Button>
        <p className={`text-muted-foreground italic mt-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          Creates an isolated directory without git for quick experiments.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border bg-card ${paddingClass}`}>
      <h2 className={`${headingClass} font-medium text-muted-foreground ${marginClass}`}>Initialize Task</h2>

      <Button
        onClick={() => setInitializeModalOpen(true)}
        className="w-full"
        size={compact ? 'sm' : 'default'}
      >
        Initialize as Worktree Task
      </Button>

      {task.type !== 'worktree' && (
        <>
          <div className="my-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            onClick={handleInitializeScratch}
            disabled={initializeScratch.isPending}
            className="w-full"
            size={compact ? 'sm' : 'default'}
          >
            {initializeScratch.isPending ? 'Creating...' : 'Initialize as Scratch Task'}
          </Button>
          <p className={`text-muted-foreground italic mt-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            Creates an isolated directory without git for quick experiments.
          </p>
        </>
      )}

      <InitializeWorktreeTaskModal
        task={task}
        open={initializeModalOpen}
        onOpenChange={setInitializeModalOpen}
      />
    </div>
  )
}
