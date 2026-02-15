import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CpuIcon,
  GitBranchIcon,
  ClaudeIcon,
  ChartLineData01Icon,
  BrowserIcon,
  GridIcon,
  AiInnovation01Icon,
  MessageMultiple01Icon,
  Database01Icon,
  GitPullRequestIcon,
  Folder01Icon,
  EyeIcon,
} from '@hugeicons/core-free-icons'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  SystemTab,
  ProcessesTab,
  ClaudeTab,
  FulcrumTab,
  WorktreesTab,
  UsageTab,
  AssistantTab,
  MessagesTab,
  MemoryTab,
  ReviewTab,
  ScratchDirsTab,
  ObserverTab,
} from '@/components/monitoring/tabs'

type MonitoringTab = 'system' | 'processes' | 'claude' | 'fulcrum' | 'worktrees' | 'scratch' | 'usage' | 'assistant' | 'messages' | 'memory' | 'review' | 'observer'

const VALID_TABS: MonitoringTab[] = ['system', 'processes', 'claude', 'fulcrum', 'worktrees', 'scratch', 'usage', 'assistant', 'messages', 'memory', 'review', 'observer']

export const Route = createFileRoute('/monitoring/')({
  component: MonitoringPage,
  validateSearch: (search: Record<string, unknown>): { tab?: MonitoringTab } => ({
    tab: VALID_TABS.includes(search.tab as MonitoringTab) ? (search.tab as MonitoringTab) : undefined,
  }),
})

function MonitoringPage() {
  const { t } = useTranslation('monitoring')
  const { tab: urlTab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const activeTab = urlTab || 'system'

  const handleTabChange = (newTab: string) => {
    const validTab = newTab as MonitoringTab
    navigate({
      search: (prev) => ({ ...prev, tab: validTab === 'system' ? undefined : validTab }),
      replace: true,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full flex-col">
          <div className="film-grain relative shrink-0 border-b border-border" style={{ background: 'var(--gradient-header)' }}>
          <TabsList className="justify-start gap-1 bg-transparent rounded-none px-4 h-10">
            <TabsTrigger value="system" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={CpuIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.system')}</span>
            </TabsTrigger>
            <TabsTrigger value="processes" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={GridIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.processes')}</span>
            </TabsTrigger>
            <TabsTrigger value="claude" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={ClaudeIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.claude')}</span>
            </TabsTrigger>
            <TabsTrigger value="fulcrum" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={BrowserIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.fulcrum')}</span>
            </TabsTrigger>
            <TabsTrigger value="worktrees" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={GitBranchIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.worktrees')}</span>
            </TabsTrigger>
            <TabsTrigger value="scratch" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={Folder01Icon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.scratch')}</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={GitPullRequestIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.review')}</span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={ChartLineData01Icon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.usage')}</span>
            </TabsTrigger>
            <TabsTrigger value="assistant" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={AiInnovation01Icon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.assistant')}</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={MessageMultiple01Icon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.messages')}</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={Database01Icon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.memory')}</span>
            </TabsTrigger>
            <TabsTrigger value="observer" className="gap-1.5 data-[state=active]:bg-muted">
              <HugeiconsIcon icon={EyeIcon} size={14} strokeWidth={2} />
              <span className="max-sm:hidden">{t('tabs.observer')}</span>
            </TabsTrigger>
          </TabsList>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <TabsContent value="system" className="m-0">
              <SystemTab />
            </TabsContent>

            <TabsContent value="processes" className="m-0">
              <ProcessesTab />
            </TabsContent>

            <TabsContent value="claude" className="m-0">
              <ClaudeTab />
            </TabsContent>

            <TabsContent value="fulcrum" className="m-0">
              <FulcrumTab />
            </TabsContent>

            <TabsContent value="worktrees" className="m-0">
              <WorktreesTab />
            </TabsContent>

            <TabsContent value="scratch" className="m-0">
              <ScratchDirsTab />
            </TabsContent>

            <TabsContent value="review" className="m-0">
              <ReviewTab />
            </TabsContent>

            <TabsContent value="usage" className="m-0">
              <UsageTab />
            </TabsContent>

            <TabsContent value="assistant" className="m-0">
              <AssistantTab />
            </TabsContent>

            <TabsContent value="messages" className="m-0">
              <MessagesTab />
            </TabsContent>

            <TabsContent value="memory" className="m-0">
              <MemoryTab />
            </TabsContent>

            <TabsContent value="observer" className="m-0">
              <ObserverTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
