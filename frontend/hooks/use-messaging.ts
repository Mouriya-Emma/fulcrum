/**
 * React Query hooks for messaging channels (WhatsApp, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { MessagingConnection, MessagingSessionMapping, MessagingConnectionStatus, EmailChannelConfig } from '@/types'

// API base URL
const API_BASE = '/api/messaging'

export interface WhatsAppStatus extends Partial<MessagingConnection> {
  enabled: boolean
  status: MessagingConnectionStatus
}

// Get all messaging channels
export function useMessagingChannels() {
  return useQuery({
    queryKey: ['messaging', 'channels'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/channels`)
      if (!res.ok) throw new Error('Failed to fetch channels')
      const data = await res.json()
      return data.channels as MessagingConnection[]
    },
  })
}

// Get WhatsApp status
export function useWhatsAppStatus() {
  return useQuery({
    queryKey: ['messaging', 'whatsapp'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp`)
      if (!res.ok) throw new Error('Failed to fetch WhatsApp status')
      return (await res.json()) as WhatsAppStatus
    },
    refetchInterval: 5000, // Poll status every 5s
  })
}

// Enable WhatsApp
export function useEnableWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/enable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to enable WhatsApp')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disable WhatsApp
export function useDisableWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/disable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disable WhatsApp')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Request WhatsApp QR code
export function useRequestWhatsAppAuth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/auth`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to request WhatsApp auth')
      return (await res.json()) as { qrDataUrl: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'whatsapp'] })
    },
  })
}

// Disconnect WhatsApp (logout and clear auth)
export function useDisconnectWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect WhatsApp')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Get WhatsApp sessions
export function useWhatsAppSessions() {
  return useQuery({
    queryKey: ['messaging', 'whatsapp', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/whatsapp/sessions`)
      if (!res.ok) throw new Error('Failed to fetch WhatsApp sessions')
      const data = await res.json()
      return data.sessions as MessagingSessionMapping[]
    },
  })
}

// ==================== Discord Hooks ====================

export interface DiscordStatus extends Partial<MessagingConnection> {
  enabled: boolean
  status: MessagingConnectionStatus
  config?: { enabled: boolean; botToken: string } | null
}

// Get Discord status
export function useDiscordStatus() {
  return useQuery({
    queryKey: ['messaging', 'discord'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/discord`)
      if (!res.ok) throw new Error('Failed to fetch Discord status')
      return (await res.json()) as DiscordStatus
    },
    refetchInterval: 5000,
  })
}

// Configure Discord with bot token (saves to settings and enables)
export function useConfigureDiscord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botToken: string) => {
      const res = await fetch(`${API_BASE}/discord/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to configure Discord')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Enable Discord using existing credentials
export function useEnableDiscord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/discord/enable`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable Discord')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disable Discord
export function useDisableDiscord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/discord/disable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disable Discord')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disconnect Discord (logout and clear auth)
export function useDisconnectDiscord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/discord/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect Discord')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Get Discord sessions
export function useDiscordSessions() {
  return useQuery({
    queryKey: ['messaging', 'discord', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/discord/sessions`)
      if (!res.ok) throw new Error('Failed to fetch Discord sessions')
      const data = await res.json()
      return data.sessions as MessagingSessionMapping[]
    },
  })
}

// ==================== Telegram Hooks ====================

export interface TelegramStatus extends Partial<MessagingConnection> {
  enabled: boolean
  status: MessagingConnectionStatus
  config?: { enabled: boolean; botToken: string } | null
}

// Get Telegram status
export function useTelegramStatus() {
  return useQuery({
    queryKey: ['messaging', 'telegram'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/telegram`)
      if (!res.ok) throw new Error('Failed to fetch Telegram status')
      return (await res.json()) as TelegramStatus
    },
    refetchInterval: 5000,
  })
}

// Configure Telegram with bot token (saves to settings and enables)
export function useConfigureTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botToken: string) => {
      const res = await fetch(`${API_BASE}/telegram/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to configure Telegram')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Enable Telegram using existing credentials
export function useEnableTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/telegram/enable`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable Telegram')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disable Telegram
export function useDisableTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/telegram/disable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disable Telegram')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disconnect Telegram (logout and clear auth)
export function useDisconnectTelegram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/telegram/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect Telegram')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Get Telegram sessions
export function useTelegramSessions() {
  return useQuery({
    queryKey: ['messaging', 'telegram', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/telegram/sessions`)
      if (!res.ok) throw new Error('Failed to fetch Telegram sessions')
      const data = await res.json()
      return data.sessions as MessagingSessionMapping[]
    },
  })
}

// ==================== Slack Hooks ====================

export interface SlackStatus extends Partial<MessagingConnection> {
  enabled: boolean
  status: MessagingConnectionStatus
  config?: { enabled: boolean; botToken: string; appToken: string } | null
}

// Get Slack status
export function useSlackStatus() {
  return useQuery({
    queryKey: ['messaging', 'slack'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/slack`)
      if (!res.ok) throw new Error('Failed to fetch Slack status')
      return (await res.json()) as SlackStatus
    },
    refetchInterval: 5000,
  })
}

// Configure Slack with bot and app tokens (saves to settings and enables)
export function useConfigureSlack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tokens: { botToken: string; appToken: string }) => {
      const res = await fetch(`${API_BASE}/slack/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to configure Slack')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Enable Slack using existing credentials
export function useEnableSlack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/slack/enable`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable Slack')
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disable Slack
export function useDisableSlack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/slack/disable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disable Slack')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disconnect Slack (logout and clear auth)
export function useDisconnectSlack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/slack/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect Slack')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Get Slack sessions
export function useSlackSessions() {
  return useQuery({
    queryKey: ['messaging', 'slack', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/slack/sessions`)
      if (!res.ok) throw new Error('Failed to fetch Slack sessions')
      const data = await res.json()
      return data.sessions as MessagingSessionMapping[]
    },
  })
}

// ==================== Email Hooks ====================

export interface EmailStatus extends Partial<MessagingConnection> {
  enabled: boolean
  status: MessagingConnectionStatus
  config?: EmailChannelConfig | null
}

export interface EmailCredentials {
  imap: {
    host: string
    port: number
    secure: boolean
    user: string
    password: string
  }
  pollIntervalSeconds: number
}

export interface EmailTestResult {
  success: boolean
  imapOk: boolean
  error?: string
}

// Get email status
export function useEmailStatus() {
  return useQuery({
    queryKey: ['messaging', 'email'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/email`)
      if (!res.ok) throw new Error('Failed to fetch email status')
      return (await res.json()) as EmailStatus
    },
    refetchInterval: 5000, // Poll status every 5s
  })
}

// Configure email
export function useConfigureEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: EmailCredentials) => {
      const res = await fetch(`${API_BASE}/email/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to configure email')
      }
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Test email credentials
export function useTestEmailCredentials() {
  return useMutation({
    mutationFn: async (credentials: EmailCredentials) => {
      const res = await fetch(`${API_BASE}/email/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to test email credentials')
      }
      return (await res.json()) as EmailTestResult
    },
  })
}

// Enable email using existing credentials
export function useEnableEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/email/enable`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable email')
      }
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Disable email
export function useDisableEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/email/disable`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disable email')
      return (await res.json()) as MessagingConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging'] })
    },
  })
}

// Get email sessions
export function useEmailSessions() {
  return useQuery({
    queryKey: ['messaging', 'email', 'sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/email/sessions`)
      if (!res.ok) throw new Error('Failed to fetch email sessions')
      const data = await res.json()
      return data.sessions as MessagingSessionMapping[]
    },
  })
}
