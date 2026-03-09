/**
 * React Query hooks for CalDAV calendar integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'

const API_BASE = ''

// Types
export interface CaldavAccountStatus {
  id: string
  name: string
  connected: boolean
  syncing: boolean
  lastError: string | null
  calendarCount: number
  enabled: boolean
  lastSyncedAt: string | null
}

export interface CaldavStatus {
  connected: boolean
  syncing: boolean
  lastError: string | null
  calendarCount: number
  accounts: CaldavAccountStatus[]
}

export interface CaldavAccount {
  id: string
  name: string
  serverUrl: string
  authType: 'basic' | 'google-oauth'
  username: string | null
  password: string | null // masked as '***'
  googleClientId: string | null
  googleClientSecret: string | null // masked as '***'
  oauthTokens: { hasTokens: boolean } | null
  syncIntervalMinutes: number | null
  enabled: boolean | null
  lastSyncedAt: string | null
  lastSyncError: string | null
  createdAt: string
  updatedAt: string
}

export interface CaldavCalendar {
  id: string
  accountId: string | null
  remoteUrl: string
  displayName: string | null
  color: string | null
  enabled: boolean | null
  lastSyncedAt: string | null
}

export interface CaldavEvent {
  id: string
  calendarId: string
  summary: string | null
  dtstart: string | null
  dtend: string | null
  allDay: boolean | null
  location: string | null
  description: string | null
}

export interface CaldavCopyRule {
  id: string
  name: string | null
  sourceCalendarId: string
  destCalendarId: string
  enabled: boolean | null
  lastExecutedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TestConnectionResult {
  success: boolean
  calendars?: number
  error?: string
}

// Status
export function useCaldavStatus() {
  return useQuery({
    queryKey: ['caldav', 'status'],
    queryFn: () => fetchJSON<CaldavStatus>(`${API_BASE}/api/caldav/status`),
    refetchInterval: 30000,
  })
}

// ==========================================
// Account hooks
// ==========================================

export function useCaldavAccounts() {
  return useQuery({
    queryKey: ['caldav', 'accounts'],
    queryFn: () => fetchJSON<CaldavAccount[]>(`${API_BASE}/api/caldav/accounts`),
  })
}

export function useCreateCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      name: string
      serverUrl: string
      username: string
      password: string
      syncIntervalMinutes?: number
    }) =>
      fetchJSON<CaldavAccount>(`${API_BASE}/api/caldav/accounts`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useCreateGoogleCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      name?: string
      googleClientId: string
      googleClientSecret: string
      syncIntervalMinutes?: number
    }) =>
      fetchJSON<CaldavAccount>(`${API_BASE}/api/caldav/accounts/google`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useUpdateCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...updates }: {
      id: string
      name?: string
      serverUrl?: string
      username?: string
      password?: string
      syncIntervalMinutes?: number
    }) =>
      fetchJSON<CaldavAccount>(`${API_BASE}/api/caldav/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useDeleteCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useEnableCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/accounts/${id}/enable`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useDisableCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/accounts/${id}/disable`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useSyncCaldavAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/accounts/${id}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useGetAccountGoogleAuthUrl() {
  return useMutation({
    mutationFn: (accountId: string) =>
      fetchJSON<{ authUrl: string }>(`${API_BASE}/api/caldav/accounts/${accountId}/oauth/authorize`),
  })
}

// ==========================================
// Copy rule hooks
// ==========================================

export function useCaldavCopyRules() {
  return useQuery({
    queryKey: ['caldav', 'copy-rules'],
    queryFn: () => fetchJSON<CaldavCopyRule[]>(`${API_BASE}/api/caldav/copy-rules`),
  })
}

export function useCreateCaldavCopyRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      name?: string
      sourceCalendarId: string
      destCalendarId: string
    }) =>
      fetchJSON<CaldavCopyRule>(`${API_BASE}/api/caldav/copy-rules`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav', 'copy-rules'] })
    },
  })
}

export function useUpdateCaldavCopyRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; enabled?: boolean }) =>
      fetchJSON<CaldavCopyRule>(`${API_BASE}/api/caldav/copy-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav', 'copy-rules'] })
    },
  })
}

export function useDeleteCaldavCopyRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/copy-rules/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav', 'copy-rules'] })
    },
  })
}

export function useExecuteCaldavCopyRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ created: number; updated: number }>(`${API_BASE}/api/caldav/copy-rules/${id}/execute`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

// ==========================================
// Backward-compatible hooks
// ==========================================

// Calendars
export function useCaldavCalendars() {
  return useQuery({
    queryKey: ['caldav', 'calendars'],
    queryFn: () => fetchJSON<CaldavCalendar[]>(`${API_BASE}/api/caldav/calendars`),
  })
}

// Test connection
export function useTestCaldavConnection() {
  return useMutation({
    mutationFn: (config: { serverUrl: string; username: string; password: string }) =>
      fetchJSON<TestConnectionResult>(`${API_BASE}/api/caldav/test`, {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  })
}

// Configure (save + connect)
export function useConfigureCaldav() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      serverUrl: string
      username: string
      password: string
      syncIntervalMinutes?: number
    }) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/configure`, {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

// Enable
export function useEnableCaldav() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/enable`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
      queryClient.invalidateQueries({ queryKey: ['config', 'caldav.enabled'] })
    },
  })
}

// Disable
export function useDisableCaldav() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/disable`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
      queryClient.invalidateQueries({ queryKey: ['config', 'caldav.enabled'] })
    },
  })
}

// Configure Google OAuth credentials
export function useConfigureGoogleCaldav() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: {
      googleClientId: string
      googleClientSecret: string
      syncIntervalMinutes?: number
    }) =>
      fetchJSON<{ success: boolean; accountId: string }>(`${API_BASE}/api/caldav/configure-google`, {
        method: 'POST',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
  })
}

// Get Google OAuth authorization URL
export function useGetGoogleAuthUrl() {
  return useMutation({
    mutationFn: () =>
      fetchJSON<{ authUrl: string }>(`${API_BASE}/api/caldav/oauth/authorize`),
  })
}

// Events for a date range
export function useCaldavEvents(from?: string, to?: string) {
  return useQuery({
    queryKey: ['caldav', 'events', from, to],
    queryFn: () =>
      fetchJSON<CaldavEvent[]>(
        `${API_BASE}/api/caldav/events?from=${from}&to=${to}&source=live`
      ),
    enabled: !!from && !!to,
  })
}

// Manual sync
export function useSyncCaldav() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/caldav/sync`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}
