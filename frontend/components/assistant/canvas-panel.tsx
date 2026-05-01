import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Code2, FileText, Eye, Edit3, Star, Pencil, Check, X, Brain, Save, Search } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ContentRenderer } from './content-renderer'
import { MarkdownEditor } from './markdown-editor'
import type { ChatSession, Artifact, Document } from './types'
import { formatDistanceToNow } from 'date-fns'

export type EditorSaveStatus = 'saved' | 'saving' | 'unsaved'

interface CanvasPanelProps {
  session: ChatSession | null
  artifacts: Artifact[]
  selectedArtifact: Artifact | null
  onSelectArtifact: (artifact: Artifact | null) => void
  editorContent: string
  onEditorContentChange: (content: string) => void
  canvasContent: string | null
  documents: Document[]
  onSelectDocument: (doc: Document) => void
  onStarDocument: (sessionId: string, starred: boolean) => void
  onRenameDocument: (sessionId: string, newFilename: string) => void
  activeTab?: 'viewer' | 'editor' | 'documents' | 'memory'
  onTabChange?: (tab: 'viewer' | 'editor' | 'documents' | 'memory') => void
  documentPath?: string | null
  onRenameCurrentDocument?: (newFilename: string) => void
  onSaveEditor?: () => void
  editorSaveStatus?: EditorSaveStatus
}

export function CanvasPanel({
  session,
  artifacts: _artifacts,
  selectedArtifact,
  onSelectArtifact: _onSelectArtifact,
  editorContent,
  onEditorContentChange,
  canvasContent,
  documents,
  onSelectDocument,
  onStarDocument,
  onRenameDocument,
  activeTab: controlledActiveTab,
  onTabChange,
  documentPath,
  onRenameCurrentDocument,
  onSaveEditor,
  editorSaveStatus,
}: CanvasPanelProps) {
  const { t } = useTranslation('assistant')
  // Note: artifacts and onSelectArtifact kept for API compatibility but unused after Gallery removal
  void _artifacts
  void _onSelectArtifact
  const [internalActiveTab, setInternalActiveTab] = useState<'viewer' | 'editor' | 'documents' | 'memory'>('viewer')

  // Use controlled or internal state
  const activeTab = controlledActiveTab ?? internalActiveTab
  const setActiveTab = (tab: 'viewer' | 'editor' | 'documents' | 'memory') => {
    if (onTabChange) {
      onTabChange(tab)
    } else {
      setInternalActiveTab(tab)
    }
  }

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <Code2 className="size-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm">{t('canvas.empty.title')}</p>
          <p className="text-xs mt-1">{t('canvas.empty.description')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted/20">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
        {/* Tab Header */}
        <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2 border-b border-border bg-background">
          <TabsList className="h-8">
            <TabsTrigger value="viewer" className="gap-1 sm:gap-1.5 text-xs px-1.5 sm:px-2">
              <Eye className="size-3" />
              <span className="hidden sm:inline">{t('canvas.tabs.canvas')}</span>
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1 sm:gap-1.5 text-xs px-1.5 sm:px-2">
              <Edit3 className="size-3" />
              <span className="hidden sm:inline">{t('canvas.tabs.editor')}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1 sm:gap-1.5 text-xs px-1.5 sm:px-2">
              <FileText className="size-3" />
              <span className="hidden sm:inline">{t('canvas.tabs.documents')}</span>
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-1 sm:gap-1.5 text-xs px-1.5 sm:px-2">
              <Brain className="size-3" />
              <span className="hidden sm:inline">{t('canvas.tabs.memory')}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {selectedArtifact && (
              <div className="text-xs text-muted-foreground hidden sm:block truncate max-w-[120px]">
                {selectedArtifact.title}
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <TabsContent value="viewer" className="flex-1 m-0 data-[state=inactive]:hidden overflow-hidden">
          <ViewerTab
            content={selectedArtifact?.content || canvasContent}
            artifact={selectedArtifact}
          />
        </TabsContent>

        <TabsContent value="editor" className="flex-1 m-0 data-[state=inactive]:hidden overflow-hidden">
          <EditorTab
            content={editorContent}
            onChange={onEditorContentChange}
            documentPath={documentPath}
            onRenameDocument={onRenameCurrentDocument}
            onSave={onSaveEditor}
            saveStatus={editorSaveStatus}
          />
        </TabsContent>

        <TabsContent value="documents" className="flex-1 m-0 data-[state=inactive]:hidden overflow-hidden">
          <DocumentsTab
            documents={documents}
            onSelectDocument={onSelectDocument}
            onStarDocument={onStarDocument}
            onRenameDocument={onRenameDocument}
          />
        </TabsContent>

        <TabsContent value="memory" className="flex-1 m-0 data-[state=inactive]:hidden overflow-hidden">
          <MemoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ViewerTabProps {
  content: string | null
  artifact: Artifact | null
}

function ViewerTab({ content, artifact }: ViewerTabProps) {
  const { t } = useTranslation('assistant')
  if (!content) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Eye className="size-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">{t('canvas.viewer.empty.title')}</p>
          <p className="text-xs mt-1">{t('canvas.viewer.empty.description')}</p>
        </div>
      </div>
    )
  }

  // If this is an artifact with a known type, pass that info to ContentRenderer
  // Artifacts store raw content without markdown wrappers
  const contentType = artifact?.type || null

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {artifact && (
          <div className="mb-4 pb-4 border-b border-border">
            <h4 className="text-sm font-medium">{artifact.title}</h4>
            {artifact.description && (
              <p className="text-xs text-muted-foreground mt-1">{artifact.description}</p>
            )}
          </div>
        )}
        <ContentRenderer content={content} contentType={contentType} />
      </div>
    </ScrollArea>
  )
}

interface EditorTabProps {
  content: string
  onChange: (content: string) => void
  documentPath?: string | null
  onRenameDocument?: (newFilename: string) => void
  onSave?: () => void
  saveStatus?: EditorSaveStatus
}

function EditorTab({ content, onChange, documentPath, onRenameDocument, onSave, saveStatus }: EditorTabProps) {
  const { t } = useTranslation('assistant')
  const [isRenaming, setIsRenaming] = useState(false)
  const [editedFilename, setEditedFilename] = useState(documentPath || '')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Sync edited filename when documentPath changes
  useEffect(() => {
    if (documentPath && !isRenaming) {
      setEditedFilename(documentPath)
    }
  }, [documentPath, isRenaming])

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      // Select filename without extension
      const dotIndex = editedFilename.lastIndexOf('.')
      renameInputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : editedFilename.length)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on rename start, not on every keystroke
  }, [isRenaming])

  const handleSaveRename = () => {
    if (editedFilename.trim() && editedFilename !== documentPath && onRenameDocument) {
      onRenameDocument(editedFilename.trim())
    }
    setIsRenaming(false)
  }

  const handleCancelRename = () => {
    setEditedFilename(documentPath || '')
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave])

  const displayFilename = documentPath || t('canvas.editor.untitled', 'Untitled.md')

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-background/50 flex items-center justify-between gap-2">
        {/* Left: filename (clickable to rename) */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <FileText className="size-3.5 text-muted-foreground shrink-0" />
          {isRenaming ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Input
                ref={renameInputRef}
                value={editedFilename}
                onChange={(e) => setEditedFilename(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleSaveRename}
                className="h-6 text-xs py-0 px-1.5 flex-1 min-w-0"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-5 shrink-0"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSaveRename()
                }}
              >
                <Check className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-5 shrink-0"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleCancelRename()
                }}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (documentPath && onRenameDocument) {
                  setEditedFilename(documentPath)
                  setIsRenaming(true)
                }
              }}
              className={cn(
                'text-xs font-medium truncate text-left',
                documentPath && onRenameDocument
                  ? 'hover:text-foreground text-muted-foreground cursor-pointer hover:underline'
                  : 'text-muted-foreground cursor-default'
              )}
              title={documentPath ? t('canvas.editor.clickToRename', 'Click to rename') : undefined}
            >
              {displayFilename}
            </button>
          )}
        </div>

        {/* Right: save status + save button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {saveStatus && (
            <span className={cn(
              'text-[0.65rem]',
              saveStatus === 'saved' && 'text-muted-foreground/60',
              saveStatus === 'saving' && 'text-muted-foreground',
              saveStatus === 'unsaved' && 'text-amber-500/80',
            )}>
              {saveStatus === 'saved' && t('canvas.editor.saved', 'Saved')}
              {saveStatus === 'saving' && t('canvas.editor.saving', 'Saving...')}
              {saveStatus === 'unsaved' && t('canvas.editor.unsaved', 'Unsaved')}
            </span>
          )}
          {onSave && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  onClick={onSave}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                >
                  <Save className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('canvas.editor.saveTooltip', 'Save (Ctrl+S)')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          content={content}
          onChange={onChange}
          placeholder={t('canvas.editor.placeholder')}
        />
      </div>
    </div>
  )
}

interface DocumentsTabProps {
  documents: Document[]
  onSelectDocument: (doc: Document) => void
  onStarDocument: (sessionId: string, starred: boolean) => void
  onRenameDocument: (sessionId: string, newFilename: string) => void
}

function DocumentsTab({
  documents,
  onSelectDocument,
  onStarDocument,
  onRenameDocument,
}: DocumentsTabProps) {
  const { t } = useTranslation('assistant')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return documents

    const titleMatches: Document[] = []
    const contentOnlyMatches: Document[] = []

    for (const doc of documents) {
      const filenameMatch = doc.filename.toLowerCase().includes(query)
      const contentMatch = doc.content?.toLowerCase().includes(query)

      if (filenameMatch) {
        titleMatches.push(doc)
      } else if (contentMatch) {
        contentOnlyMatches.push(doc)
      }
    }

    return [...titleMatches, ...contentOnlyMatches]
  }, [documents, searchQuery])

  if (documents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="size-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">{t('canvas.documents.empty.title')}</p>
          <p className="text-xs mt-1">{t('canvas.documents.empty.description')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('canvas.documents.search', 'Search documents...')}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-xs">{t('canvas.documents.noResults', 'No documents match your search')}</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.sessionId}
                document={doc}
                onSelect={() => onSelectDocument(doc)}
                onStar={(starred) => onStarDocument(doc.sessionId, starred)}
                onRename={(filename) => onRenameDocument(doc.sessionId, filename)}
                searchQuery={searchQuery.trim() || undefined}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function MemoryTab() {
  const { t } = useTranslation('assistant')
  const queryClient = useQueryClient()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localContent, setLocalContent] = useState<string | null>(null)
  const isDirtyRef = useRef(false)

  const { data, isLoading } = useQuery<{ content: string; path: string }>({
    queryKey: ['memory-file'],
    queryFn: async () => {
      const res = await fetch('/api/memory-file')
      return res.json()
    },
    refetchInterval: 3000,
  })

  // Sync server data to local state when user isn't editing
  useEffect(() => {
    if (data?.content != null && !isDirtyRef.current) {
      setLocalContent(data.content)
    }
  }, [data?.content])

  const saveContent = useCallback(async (content: string) => {
    await fetch('/api/memory-file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    isDirtyRef.current = false
    queryClient.invalidateQueries({ queryKey: ['memory-file'] })
  }, [queryClient])

  const handleChange = useCallback((newContent: string) => {
    isDirtyRef.current = true
    setLocalContent(newContent)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(newContent)
    }, 500)
  }, [saveContent])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Brain className="size-12 mx-auto mb-4 opacity-20 animate-pulse" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-background/50 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t('canvas.memory.title')}
        </div>
        <div className="text-[0.65rem] text-muted-foreground/60 font-mono">
          {data?.path || t('canvas.memory.path')}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          content={localContent ?? ''}
          onChange={handleChange}
          placeholder={t('canvas.memory.placeholder')}
        />
      </div>
    </div>
  )
}

interface DocumentCardProps {
  document: Document
  onSelect: () => void
  onStar: (starred: boolean) => void
  onRename: (filename: string) => void
  searchQuery?: string
}

function DocumentCard({ document, onSelect, onStar, onRename, searchQuery }: DocumentCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedFilename, setEditedFilename] = useState(document.filename)

  const handleSaveRename = () => {
    if (editedFilename && editedFilename !== document.filename) {
      onRename(editedFilename)
    }
    setIsEditing(false)
  }

  const handleCancelRename = () => {
    setEditedFilename(document.filename)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 transition-all',
        'hover:border-accent/50 hover:shadow-sm cursor-pointer'
      )}
      onClick={(e) => {
        // Don't trigger select when clicking on controls
        if ((e.target as HTMLElement).closest('button, input')) return
        onSelect()
      }}
    >
      <div className="flex items-start gap-3">
        <FileText className="size-5 text-muted-foreground mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editedFilename}
                onChange={(e) => setEditedFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-6 text-xs py-0 px-1"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSaveRename()
                }}
              >
                <Check className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancelRename()
                }}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h5 className="text-sm font-medium truncate">{document.filename}</h5>
              <Button
                size="icon"
                variant="ghost"
                className="size-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                }}
              >
                <Pencil className="size-3" />
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {document.sessionTitle}
          </p>

          <p className="text-xs text-muted-foreground/70 mt-1">
            {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
          </p>

          {searchQuery && document.content && (() => {
            const query = searchQuery.toLowerCase()
            const content = document.content!
            const idx = content.toLowerCase().indexOf(query)
            if (idx === -1) return null
            const contextChars = 40
            const start = Math.max(0, idx - contextChars)
            const end = Math.min(content.length, idx + query.length + contextChars)
            const before = (start > 0 ? '...' : '') + content.slice(start, idx)
            const match = content.slice(idx, idx + query.length)
            const after = content.slice(idx + query.length, end) + (end < content.length ? '...' : '')
            return (
              <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 break-all">
                {before}<span className="bg-yellow-500/20 text-foreground font-medium">{match}</span>{after}
              </p>
            )
          })()}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className={cn(
            'size-6 shrink-0',
            document.starred
              ? 'text-yellow-500'
              : 'text-muted-foreground opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onStar(!document.starred)
          }}
        >
          <Star
            className={cn('size-4', document.starred && 'fill-yellow-500')}
          />
        </Button>
      </div>
    </div>
  )
}
