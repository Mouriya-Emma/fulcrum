/**
 * Email API - Functions for managing Email channel configuration and state.
 * Configuration stored in settings.json under channels.email.
 * Includes email search and storage functions.
 */

import { getSettings, updateSettingByPath } from '../../../lib/settings'
import { testEmailCredentials as testEmailCreds } from '../email-channel'
import {
  activeChannels,
  getActiveEmailChannel,
  getActiveGmailBackend,
  EMAIL_CONNECTION_ID,
  startEmailChannel,
  stopEmailChannel,
} from '../channel-manager'
import { getStoredEmails as getStoredEmailsFromDb } from '../email-storage'
import { listMessages } from '../../google/gmail-service'
import type { ConnectionStatus, EmailAuthState } from '../types'

// Re-export connection ID for backward compatibility
export { EMAIL_CONNECTION_ID } from '../channel-manager'

/**
 * Configure email with credentials and enable the channel.
 * Saves configuration to settings.json and starts the channel.
 */
export async function configureEmail(credentials: EmailAuthState): Promise<{
  enabled: boolean
  status: ConnectionStatus
}> {
  const MASKED = '••••••••'

  // Stop existing channel if running
  await stopEmailChannel()

  // Get existing settings to preserve masked passwords
  const settings = getSettings()
  const stored = settings.channels.email

  // Determine final password (use stored if masked)
  const imapPassword = credentials.imap.password === MASKED ? stored.imap.password : credentials.imap.password

  // Save credentials to settings
  updateSettingByPath('channels.email.enabled', true)
  updateSettingByPath('channels.email.imap.host', credentials.imap.host)
  updateSettingByPath('channels.email.imap.port', credentials.imap.port)
  updateSettingByPath('channels.email.imap.secure', credentials.imap.secure)
  updateSettingByPath('channels.email.imap.user', credentials.imap.user)
  updateSettingByPath('channels.email.imap.password', imapPassword)
  updateSettingByPath('channels.email.pollIntervalSeconds', credentials.pollIntervalSeconds)

  // Start the channel
  await startEmailChannel()

  // Get the active channel reference after starting
  const channel = activeChannels.get(EMAIL_CONNECTION_ID)

  return {
    enabled: true,
    status: channel?.getStatus() || 'connecting',
  }
}

/**
 * Test email credentials without saving them.
 * If passwords are masked (••••••••), uses stored credentials instead.
 */
export async function testEmailCredentials(credentials: EmailAuthState): Promise<{
  success: boolean
  imapOk: boolean
  error?: string
}> {
  const MASKED = '••••••••'

  // If password is masked, substitute with stored credentials
  let finalCreds = credentials
  if (credentials.imap.password === MASKED) {
    const settings = getSettings()
    const stored = settings.channels.email

    if (!stored.imap.password) {
      return {
        success: false,
        imapOk: false,
        error: 'No stored credentials found. Please enter password.',
      }
    }

    finalCreds = {
      ...credentials,
      imap: {
        ...credentials.imap,
        password: stored.imap.password,
      },
    }
  }

  return testEmailCreds(finalCreds)
}

/**
 * Enable email using existing credentials from settings.
 * Returns an error if credentials are not configured.
 */
export async function enableEmail(): Promise<{
  enabled: boolean
  status: ConnectionStatus
  error?: string
}> {
  const settings = getSettings()
  const emailConfig = settings.channels.email

  // Check if we have valid IMAP credentials
  if (!emailConfig.imap.host || !emailConfig.imap.user || !emailConfig.imap.password) {
    return {
      enabled: false,
      status: 'credentials_required',
      error: 'Email credentials not configured. Please configure IMAP settings first.',
    }
  }

  // Stop existing channel if running
  await stopEmailChannel()

  // Update settings to enable
  updateSettingByPath('channels.email.enabled', true)

  // Start the channel
  await startEmailChannel()

  // Get the active channel reference after starting
  const channel = activeChannels.get(EMAIL_CONNECTION_ID)

  return {
    enabled: true,
    status: channel?.getStatus() || 'connecting',
  }
}

/**
 * Disable email and stop the channel.
 */
export async function disableEmail(): Promise<{
  enabled: boolean
  status: ConnectionStatus
}> {
  await stopEmailChannel()

  // Update settings to disable
  updateSettingByPath('channels.email.enabled', false)

  return {
    enabled: false,
    status: 'disconnected',
  }
}

/**
 * Get email connection status.
 */
export function getEmailStatus(): {
  enabled: boolean
  status: ConnectionStatus
} {
  const settings = getSettings()
  const emailConfig = settings.channels.email

  if (!emailConfig.enabled) {
    return { enabled: false, status: 'disconnected' }
  }

  // Check if we have valid IMAP credentials
  if (!emailConfig.imap.host || !emailConfig.imap.user || !emailConfig.imap.password) {
    return { enabled: true, status: 'credentials_required' }
  }

  const channel = activeChannels.get(EMAIL_CONNECTION_ID)

  return {
    enabled: true,
    status: channel?.getStatus() || 'disconnected',
  }
}

/**
 * Get email configuration (passwords masked with ********).
 */
export function getEmailConfig(): {
  imap: { host: string; port: number; secure: boolean; user: string; password: string } | null
  pollIntervalSeconds: number
} | null {
  const settings = getSettings()
  const emailConfig = settings.channels.email

  if (!emailConfig.imap.host) {
    return null
  }

  return {
    imap: emailConfig.imap.host ? {
      host: emailConfig.imap.host,
      port: emailConfig.imap.port,
      secure: emailConfig.imap.secure,
      user: emailConfig.imap.user,
      password: emailConfig.imap.password ? '••••••••' : '',
    } : null,
    pollIntervalSeconds: emailConfig.pollIntervalSeconds,
  }
}

// ==========================================================================
// Email Search & Storage API
// ==========================================================================

/**
 * Get stored emails from the local database.
 * Works with both IMAP and Gmail API backends (queries DB directly).
 */
export function getStoredEmails(options?: {
  limit?: number
  offset?: number
  direction?: 'incoming' | 'outgoing'
  threadId?: string
  search?: string
  folder?: string
}) {
  return getStoredEmailsFromDb({
    connectionId: EMAIL_CONNECTION_ID,
    ...options,
  })
}

/**
 * Search emails via IMAP or Gmail API and return results.
 * With IMAP backend: returns matching UIDs.
 * With Gmail backend: uses Gmail API search (query string).
 */
export async function searchImapEmails(criteria: {
  subject?: string
  from?: string
  to?: string
  since?: Date
  before?: Date
  text?: string
  seen?: boolean
  flagged?: boolean
}): Promise<number[]> {
  const activeEmailChannel = getActiveEmailChannel()
  if (activeEmailChannel) {
    return activeEmailChannel.searchImapEmails(criteria)
  }

  // Gmail backend: build a Gmail search query and search via API
  const gmailBackend = getActiveGmailBackend()
  if (gmailBackend) {
    const settings = getSettings()
    const googleAccountId = settings.channels.email.googleAccountId
    if (!googleAccountId) throw new Error('Gmail backend has no Google account configured')

    const queryParts: string[] = []
    if (criteria.subject) queryParts.push(`subject:${criteria.subject}`)
    if (criteria.from) queryParts.push(`from:${criteria.from}`)
    if (criteria.to) queryParts.push(`to:${criteria.to}`)
    if (criteria.text) queryParts.push(criteria.text)
    if (criteria.since) queryParts.push(`after:${criteria.since.toISOString().split('T')[0]}`)
    if (criteria.before) queryParts.push(`before:${criteria.before.toISOString().split('T')[0]}`)
    if (criteria.seen === false) queryParts.push('is:unread')
    if (criteria.seen === true) queryParts.push('is:read')
    if (criteria.flagged === true) queryParts.push('is:starred')

    const messages = await listMessages(googleAccountId, {
      query: queryParts.join(' '),
      maxResults: 50,
    })

    // Store search results in local DB for the MCP tools to access
    const { storeEmail } = await import('../email-storage')
    for (const msg of messages) {
      if (!msg.id) continue
      const fromMatch = msg.from?.match(/<([^>]+)>/)
      const fromEmail = (fromMatch ? fromMatch[1] : msg.from ?? '').toLowerCase()
      storeEmail({
        connectionId: EMAIL_CONNECTION_ID,
        messageId: msg.messageId ?? msg.id,
        threadId: msg.threadId ?? undefined,
        inReplyTo: msg.inReplyTo ?? undefined,
        direction: 'incoming',
        fromAddress: fromEmail || 'unknown',
        fromName: msg.from?.replace(/<[^>]+>/, '').trim() || undefined,
        toAddresses: msg.to.length > 0 ? msg.to : undefined,
        ccAddresses: msg.cc.length > 0 ? msg.cc : undefined,
        subject: msg.subject ?? undefined,
        textContent: msg.body ?? undefined,
        emailDate: msg.date ? new Date(msg.date) : undefined,
      })
    }

    // Return empty array — Gmail API doesn't use UIDs, but results are now in the DB
    // Callers should use getStoredEmails() to retrieve the results
    return []
  }

  throw new Error('Email channel not configured')
}

/**
 * Fetch emails by UID from IMAP and store them locally.
 * Not supported with Gmail API backend (use getStoredEmails instead).
 */
export async function fetchAndStoreEmails(uids: number[], options?: { limit?: number }) {
  const activeEmailChannel = getActiveEmailChannel()
  if (activeEmailChannel) {
    return activeEmailChannel.fetchAndStoreEmails(uids, options)
  }

  if (getActiveGmailBackend()) {
    throw new Error('IMAP UID fetch not available with Gmail API backend. Use list_emails to view stored emails.')
  }

  throw new Error('Email channel not configured')
}

