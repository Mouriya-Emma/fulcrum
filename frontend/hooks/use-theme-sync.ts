import { useEffect, useCallback, useRef } from 'react'
import { useTheme as useNextTheme } from 'next-themes'
import { type Theme } from './use-config'
import { useStore } from '@/stores'
import { reaction } from 'mobx'

/**
 * Hook to sync theme across all clients via WebSocket.
 * - Listens for theme:synced messages from server
 * - Broadcasts theme changes to all connected clients
 */
export function useThemeSync() {
  const store = useStore()
  const { setTheme, resolvedTheme, theme: currentTheme } = useNextTheme()

  // Track if we're applying a broadcasted theme (to skip re-broadcasting)
  const isApplyingBroadcast = useRef(false)

  // Use MobX reaction to listen for broadcasted theme changes
  // This properly observes MST volatile state
  useEffect(() => {
    const dispose = reaction(
      () => store.broadcastedTheme,
      (broadcastedTheme) => {
        if (broadcastedTheme) {
          isApplyingBroadcast.current = true
          setTheme(broadcastedTheme)
          store.clearBroadcastedTheme()
          // Reset flag after a tick to allow changeTheme to work normally
          setTimeout(() => {
            isApplyingBroadcast.current = false
          }, 0)
        }
      },
      { fireImmediately: true }
    )
    return dispose
  }, [store, setTheme])

  // Update favicon
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.href = '/logo.png'
  }, [])

  // Function to change theme and broadcast to all clients
  const changeTheme = useCallback(
    (theme: Theme) => {
      // Skip if this is from a broadcast (prevents feedback loop)
      if (isApplyingBroadcast.current) return

      setTheme(theme)

      // Broadcast via WebSocket to all clients (server also persists to settings)
      store.syncTheme(theme)
    },
    [setTheme, store]
  )

  return {
    theme: (currentTheme as Theme) ?? 'system',
    resolvedTheme: resolvedTheme as 'light' | 'dark' | undefined,
    changeTheme,
    isUpdating: false,
  }
}
