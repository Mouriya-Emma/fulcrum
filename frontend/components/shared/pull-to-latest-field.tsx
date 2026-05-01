import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
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

  const noRemoteBranches = remoteBranches.length === 0

  // Sync internal toggle to source-repo capability: switching repos from
  // with-remote (where user pulled toggle on) to no-remote shouldn't leave
  // pullToLatest=true in form state, or submit would send a flag the server
  // can't honour.
  useEffect(() => {
    if (noRemoteBranches && pullToLatest) {
      onPullToLatestChange(false)
    }
  }, [noRemoteBranches, pullToLatest, onPullToLatestChange])

  const fullyDisabled = disabled || noRemoteBranches

  return (
    <>
      <Field data-disabled={fullyDisabled || undefined}>
        <div
          className="flex items-center justify-between"
          title={noRemoteBranches ? t('createModal.pullToLatestNoRemoteBranches') : undefined}
        >
          <FieldLabel>{t('createModal.pullToLatest')}</FieldLabel>
          <Switch
            checked={pullToLatest && !noRemoteBranches}
            onCheckedChange={onPullToLatestChange}
            disabled={fullyDisabled}
            aria-disabled={fullyDisabled}
            size="sm"
          />
        </div>
        {noRemoteBranches && (
          <FieldDescription>
            {t('createModal.pullToLatestNoRemoteBranches')}
          </FieldDescription>
        )}
        {!noRemoteBranches && pullToLatest && unpushedCommits > 0 && (
          <p className="text-sm text-destructive">
            {t('createModal.pullToLatestBlockedByUnpushed', { count: unpushedCommits, branch: baseBranch })}
          </p>
        )}
        {!noRemoteBranches && pullToLatest && !unpushedCommits && (
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
        {!noRemoteBranches && pullToLatest && !unpushedCommits && (
          <FieldDescription>{t('createModal.pullToLatestHint')}</FieldDescription>
        )}
      </Field>

      {uncommittedFiles > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('createModal.uncommittedFilesNotice', { count: uncommittedFiles })}
        </p>
      )}
    </>
  )
}
