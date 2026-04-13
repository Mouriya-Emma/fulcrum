import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight03Icon,
  FloppyDiskIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { MonacoEditor } from './monaco-editor'
import { useTerminalStore } from '@/stores'
import { useHomeDir } from '@/hooks/use-config'
import { fetchJSON } from '@/lib/api'
import { toast } from 'sonner'

const STORAGE_PREFIX = 'scratch-editor:'
const SAVE_DEBOUNCE_MS = 300

function focusLeftTerminal() {
  // xterm.js creates a hidden textarea with this class for keyboard input.
  // The left-side TaskTerminal is the first one in DOM order.
  const textarea = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
  textarea?.focus()
}

interface ScratchEditorProps {
  taskId: string
  worktreePath: string | null
  terminalId: string | null
}

export function ScratchEditor({ taskId, worktreePath, terminalId }: ScratchEditorProps) {
  const { writeToTerminal } = useTerminalStore()
  const { data: homeDir } = useHomeDir()
  const [content, setContent] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_PREFIX + taskId) ?? ''
    } catch {
      return ''
    }
  })

  // Tilde-contracted default save path
  const tildePath = (p: string) => homeDir ? p.replace(new RegExp(`^${homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '~') : p
  const expandTilde = (p: string) => homeDir ? p.replace(/^~/, homeDir) : p
  const defaultSavePath = worktreePath ? tildePath(`${worktreePath}/scratch.txt`) : 'scratch.txt'

  const [showSaveInput, setShowSaveInput] = useState(false)
  const [savePath, setSavePath] = useState(defaultSavePath)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  contentRef.current = content
  const terminalIdRef = useRef(terminalId)
  terminalIdRef.current = terminalId

  // Update default save path when homeDir loads
  useEffect(() => {
    if (homeDir) {
      setSavePath(prev => {
        // Only update if still at a default-looking value (not user-edited)
        if (prev === 'scratch.txt' || prev === defaultSavePath) return defaultSavePath
        return prev
      })
    }
  }, [homeDir, defaultSavePath])

  // Debounced localStorage persistence
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_PREFIX + taskId, content)
      } catch {
        // localStorage full or unavailable
      }
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [content, taskId])

  // Focus and select save input when it appears
  useEffect(() => {
    if (showSaveInput) {
      saveInputRef.current?.focus()
      saveInputRef.current?.select()
    }
  }, [showSaveInput])

  const handleSendToTerminal = useCallback(() => {
    if (!terminalId || !content) return
    writeToTerminal(terminalId, content)
    focusLeftTerminal()
  }, [terminalId, content, writeToTerminal])

  // Cmd/Ctrl+Enter keybinding to send to terminal
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent
      if ((ke.metaKey || ke.ctrlKey) && ke.key === 'Enter') {
        const tid = terminalIdRef.current
        const text = contentRef.current
        if (!tid || !text) return
        ke.preventDefault()
        ke.stopPropagation()
        writeToTerminal(tid, text)
        focusLeftTerminal()
      }
    }
    // Use capture to intercept before Monaco handles it
    el.addEventListener('keydown', handleKeyDown, true)
    return () => el.removeEventListener('keydown', handleKeyDown, true)
  }, [writeToTerminal])

  const handleClear = useCallback(() => {
    setContent('')
    try {
      localStorage.removeItem(STORAGE_PREFIX + taskId)
    } catch {
      // ignore
    }
  }, [taskId])

  const handleSaveToFile = useCallback(async () => {
    const trimmed = savePath.trim()
    if (!trimmed) return

    // Expand ~ and split into directory (root) + filename (path)
    const absolutePath = expandTilde(trimmed)
    const lastSlash = absolutePath.lastIndexOf('/')
    const root = lastSlash > 0 ? absolutePath.slice(0, lastSlash) : '/'
    const fileName = lastSlash >= 0 ? absolutePath.slice(lastSlash + 1) : absolutePath

    try {
      await fetchJSON('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root,
          path: fileName,
          content,
          create: true,
        }),
      })
      toast.success(`Saved to ${trimmed}`)
      setShowSaveInput(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save file')
    }
  }, [savePath, content, expandTilde])

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveToFile()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowSaveInput(false)
    }
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSendToTerminal}
          disabled={!terminalId || !content}
          title={!terminalId ? 'No terminal available' : 'Send buffer to terminal (Cmd+Enter)'}
        >
          <HugeiconsIcon icon={ArrowRight03Icon} size={14} strokeWidth={2} />
          Send to Terminal
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSaveInput(!showSaveInput)}
          disabled={!content}
          title="Save buffer to a file"
        >
          <HugeiconsIcon icon={FloppyDiskIcon} size={14} strokeWidth={2} />
          Save
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!content}
          title="Clear buffer"
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
          Clear
        </Button>
      </div>

      {/* Save-to-file inline input */}
      {showSaveInput && (
        <div className="flex items-center gap-2 border-b border-border px-2 py-1">
          <span className="text-xs text-muted-foreground shrink-0">Save as:</span>
          <Input
            ref={saveInputRef}
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            placeholder="~/path/to/file.txt"
            className="h-7 text-xs font-mono"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveToFile}
            disabled={!savePath.trim()}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveInput(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          filePath="scratch.txt"
          content={content}
          onChange={setContent}
        />
      </div>
    </div>
  )
}
