import { useTranslation } from 'react-i18next'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PullToLatestFieldProps {
  pullToLatest: boolean
  onPullToLatestChange: (value: boolean) => void
  pullRemoteBranch: string
  onPullRemoteBranchChange: (value: string) => void
  remoteBranches: string[]
  unpushedCommits: number
  uncommittedFiles: number
  baseBranch: string
  disabled?: boolean
}

export function PullToLatestField({
  pullToLatest,
  onPullToLatestChange,
  pullRemoteBranch,
  onPullRemoteBranchChange,
  remoteBranches,
  unpushedCommits,
  uncommittedFiles,
  baseBranch,
  disabled,
}: PullToLatestFieldProps) {
  const { t } = useTranslation('tasks')

  if (remoteBranches.length === 0) return null

  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{t('createModal.pullToLatest')}</FieldLabel>
        <Switch
          checked={pullToLatest}
          onCheckedChange={onPullToLatestChange}
          size="sm"
        />
      </div>
      {pullToLatest && unpushedCommits > 0 && (
        <p className="text-sm text-destructive">
          {t('createModal.pullToLatestBlockedByUnpushed', { count: unpushedCommits, branch: baseBranch })}
        </p>
      )}
      {pullToLatest && !unpushedCommits && (
        <Select
          value={pullRemoteBranch}
          onValueChange={(v) => onPullRemoteBranchChange(v ?? '')}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {pullRemoteBranch || (
                <span className="text-muted-foreground">
                  {t('createModal.selectPullBranch')}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {remoteBranches.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {pullToLatest && !unpushedCommits && (
        <FieldDescription>{t('createModal.pullToLatestHint')}</FieldDescription>
      )}
      {uncommittedFiles > 0 && (
        <FieldDescription className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
          <HugeiconsIcon icon={Alert02Icon} size={14} className="mt-0.5 shrink-0" />
          <span>{t('createModal.uncommittedFilesNotice', { count: uncommittedFiles })}</span>
        </FieldDescription>
      )}
    </Field>
  )
}
