import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  AlertCircleIcon,
  Mail01Icon,
  WhatsappIcon,
  DiscordIcon,
  TelegramIcon,
  SlackIcon,
  MessageMultiple01Icon,
  EyeIcon,
  FilterIcon,
} from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  useObserverInvocations,
  useObserverStatus,
  useObserverStats,
  type ObserverInvocation,
} from '@/hooks/use-observer'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '...'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return CheckmarkCircle02Icon
    case 'failed':
      return Cancel01Icon
    case 'timeout':
      return AlertCircleIcon
    case 'circuit_open':
      return AlertCircleIcon
    case 'processing':
      return Loading03Icon
    default:
      return Clock01Icon
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-500'
    case 'failed':
      return 'text-destructive'
    case 'timeout':
      return 'text-yellow-500'
    case 'circuit_open':
      return 'text-orange-500'
    case 'processing':
      return 'text-blue-500 animate-spin'
    default:
      return 'text-muted-foreground'
  }
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case 'email':
      return Mail01Icon
    case 'whatsapp':
      return WhatsappIcon
    case 'discord':
      return DiscordIcon
    case 'telegram':
      return TelegramIcon
    case 'slack':
      return SlackIcon
    default:
      return MessageMultiple01Icon
  }
}

function getChannelColor(channel: string): string {
  switch (channel) {
    case 'email':
      return 'text-blue-500'
    case 'whatsapp':
      return 'text-green-500'
    case 'discord':
      return 'text-indigo-500'
    case 'telegram':
      return 'text-sky-500'
    case 'slack':
      return 'text-purple-500'
    default:
      return 'text-muted-foreground'
  }
}

function InvocationRow({ invocation }: { invocation: ObserverInvocation }) {
  const { t } = useTranslation('monitoring')
  const [isOpen, setIsOpen] = useState(false)
  const StatusIcon = getStatusIcon(invocation.status)
  const statusColor = getStatusColor(invocation.status)
  const ChannelIcon = getChannelIcon(invocation.channelType)
  const channelColor = getChannelColor(invocation.channelType)

  const hasDetails = invocation.error || (invocation.actions && invocation.actions.length > 0)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild disabled={!hasDetails}>
        <div className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${hasDetails ? 'cursor-pointer hover:bg-muted/50' : ''}`}>
          <HugeiconsIcon icon={StatusIcon} size={16} strokeWidth={2} className={statusColor} />
          <HugeiconsIcon icon={ChannelIcon} size={14} strokeWidth={2} className={channelColor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {invocation.senderName || invocation.senderId}
              </span>
              <Badge variant="outline" className="text-xs shrink-0">
                {invocation.provider === 'opencode' ? 'OpenCode' : 'Claude'}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDuration(invocation.startedAt, invocation.completedAt)}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(invocation.startedAt)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {invocation.messagePreview}
            </div>
            {invocation.actions && invocation.actions.length > 0 && !isOpen && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {invocation.actions.map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {a.type === 'create_task'
                      ? t('observer.actions.createTask')
                      : t('observer.actions.storeMemory')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {hasDetails && (
            <HugeiconsIcon
              icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground shrink-0"
            />
          )}
        </div>
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-b last:border-b-0 bg-muted/30 space-y-2">
            {invocation.error && (
              <div className="text-sm text-destructive">
                <span className="font-medium">{t('observer.details.error')}:</span> {invocation.error}
              </div>
            )}
            {invocation.actions && invocation.actions.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t('observer.details.actions')}:</div>
                {invocation.actions.map((action, i) => (
                  <div key={i} className="text-sm pl-2 border-l-2 border-muted">
                    {action.type === 'create_task' && (
                      <span>{t('observer.actions.createTask')}: {action.title}</span>
                    )}
                    {action.type === 'store_memory' && (
                      <span>{t('observer.actions.storeMemory')}: {action.content?.slice(0, 100)}</span>
                    )}
                    {action.tags && action.tags.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        [{action.tags.join(', ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export default function ObserverTab() {
  const { t } = useTranslation('monitoring')
  const [channelFilter, setChannelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')

  const { data: statusData } = useObserverStatus()
  const { data: statsData } = useObserverStats()
  const { data: invocationsData, isLoading } = useObserverInvocations({
    channelType: channelFilter !== 'all' ? channelFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    limit: 50,
  })

  const cb = statusData?.circuitBreaker
  const isCircuitOpen = cb?.state === 'open'

  const successRate = statsData && statsData.total > 0
    ? Math.round((statsData.completed / statsData.total) * 100)
    : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        {/* Row 1: Title + Status Badge + Stats */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <HugeiconsIcon icon={EyeIcon} size={16} strokeWidth={2} />
              {t('observer.invocations.title')}
            </CardTitle>
            {cb && (
              <Badge variant={isCircuitOpen ? 'destructive' : 'secondary'} className="gap-1">
                <HugeiconsIcon
                  icon={isCircuitOpen ? AlertCircleIcon : CheckmarkCircle02Icon}
                  size={12}
                  strokeWidth={2}
                />
                {isCircuitOpen
                  ? `${t('observer.status.circuitOpen')} (${cb.failureCount}/${cb.failureThreshold})`
                  : t('observer.status.healthy')}
              </Badge>
            )}
          </div>
          {statsData && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><span className="font-medium tabular-nums">{statsData.total}</span> {t('observer.stats.total').toLowerCase()}</span>
              <span className="text-border">|</span>
              <span><span className="font-medium tabular-nums">{successRate}%</span> {t('observer.stats.successRate').toLowerCase()}</span>
              <span className="text-border">|</span>
              <span><span className="font-medium tabular-nums">{statsData.avgDurationMs > 0 ? `${(statsData.avgDurationMs / 1000).toFixed(1)}s` : '-'}</span> avg</span>
              <span className="text-border">|</span>
              <span><span className="font-medium tabular-nums">{statsData.tasksCreated}</span> tasks</span>
              <span className="text-border">|</span>
              <span><span className="font-medium tabular-nums">{statsData.memoriesStored}</span> memories</span>
              <span className="text-border">|</span>
              <span><span className="font-medium tabular-nums">{statsData.last24h}</span> /24h</span>
            </div>
          )}
        </div>

        {/* Row 2: Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Select value={channelFilter} onValueChange={(v) => v && setChannelFilter(v)}>
            <SelectTrigger size="sm" className="w-[130px] shrink-0 gap-1.5">
              <HugeiconsIcon icon={FilterIcon} size={12} strokeWidth={2} className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('observer.filters.allChannels')}</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger size="sm" className="w-[130px] shrink-0 gap-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('observer.filters.allStatuses')}</SelectItem>
              <SelectItem value="completed">{t('observer.filters.completed')}</SelectItem>
              <SelectItem value="failed">{t('observer.filters.failed')}</SelectItem>
              <SelectItem value="timeout">{t('observer.filters.timeout')}</SelectItem>
              <SelectItem value="circuit_open">{t('observer.filters.circuitOpen')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={providerFilter} onValueChange={(v) => v && setProviderFilter(v)}>
            <SelectTrigger size="sm" className="w-[130px] shrink-0 gap-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('observer.filters.allProviders')}</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="opencode">OpenCode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <HugeiconsIcon icon={Loading03Icon} size={24} strokeWidth={2} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && invocationsData?.invocations && invocationsData.invocations.length > 0 ? (
          <div className="divide-y">
            {invocationsData.invocations.map((inv) => (
              <InvocationRow key={inv.id} invocation={inv} />
            ))}
          </div>
        ) : !isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('observer.invocations.empty')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
