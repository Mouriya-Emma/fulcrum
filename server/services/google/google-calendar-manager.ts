/**
 * Google Calendar Manager
 *
 * Manages Google Calendar API clients per account, with sync scheduling
 * and event CRUD operations. Synced calendars and events are stored in
 * the shared caldavCalendars/caldavEvents tables with googleAccountId FK.
 */

import { google, type calendar_v3 } from 'googleapis'
import { eq } from 'drizzle-orm'
import { db, googleAccounts, caldavCalendars, caldavEvents } from '../../db'
import { getAuthenticatedClient } from '../google-oauth'
import { createLogger } from '../../lib/logger'

const logger = createLogger('Google:Calendar')

interface CalendarConnection {
  accountId: string
  syncInterval: ReturnType<typeof setInterval> | null
  isSyncing: boolean
  lastSyncError: string | null
}

class GoogleCalendarManager {
  private connections = new Map<string, CalendarConnection>()

  async startAccount(accountId: string): Promise<void> {
    // Stop existing if any
    this.stopAccount(accountId)

    const account = db
      .select()
      .from(googleAccounts)
      .where(eq(googleAccounts.id, accountId))
      .get()

    if (!account || !account.calendarEnabled) return

    const conn: CalendarConnection = {
      accountId,
      syncInterval: null,
      isSyncing: false,
      lastSyncError: null,
    }
    this.connections.set(accountId, conn)

    // Initial sync
    try {
      await this.syncAccount(accountId)
    } catch (err) {
      logger.error('Initial Google Calendar sync failed', {
        accountId,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Schedule periodic sync
    const intervalMs = (account.syncIntervalMinutes ?? 15) * 60 * 1000
    conn.syncInterval = setInterval(() => {
      this.syncAccount(accountId).catch((err) => {
        logger.error('Periodic Google Calendar sync failed', {
          accountId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }, intervalMs)

    logger.info('Started Google Calendar account', { accountId, name: account.name })
  }

  stopAccount(accountId: string): void {
    const conn = this.connections.get(accountId)
    if (!conn) return

    if (conn.syncInterval) {
      clearInterval(conn.syncInterval)
    }
    this.connections.delete(accountId)
  }

  stopAll(): void {
    for (const [accountId] of this.connections) {
      this.stopAccount(accountId)
    }
  }

  async startAll(): Promise<void> {
    const accounts = db
      .select()
      .from(googleAccounts)
      .where(eq(googleAccounts.calendarEnabled, true))
      .all()

    logger.info('Starting Google Calendar accounts', { count: accounts.length })

    for (const account of accounts) {
      await this.startAccount(account.id).catch((err) => {
        logger.error('Failed to start Google Calendar account', {
          accountId: account.id,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  async syncAccount(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId)
    if (conn?.isSyncing) return

    // Skip sync if account needs re-authorization
    const account = db
      .select()
      .from(googleAccounts)
      .where(eq(googleAccounts.id, accountId))
      .get()
    if (account?.needsReauth) {
      logger.warn('Skipping sync — account needs re-authorization', { accountId })
      return
    }

    if (conn) conn.isSyncing = true

    try {
      const auth = await getAuthenticatedClient(accountId)
      const calendar = google.calendar({ version: 'v3', auth })

      // Fetch calendar list
      const calListRes = await calendar.calendarList.list()
      const remoteCalendars = calListRes.data.items ?? []

      const now = new Date().toISOString()
      const seenRemoteUrls = new Set<string>()

      for (const remoteCal of remoteCalendars) {
        if (!remoteCal.id) continue

        // Use Google Calendar ID as remoteUrl (unique identifier)
        const remoteUrl = `google-calendar://${remoteCal.id}`
        seenRemoteUrls.add(remoteUrl)

        const existing = db
          .select()
          .from(caldavCalendars)
          .where(eq(caldavCalendars.remoteUrl, remoteUrl))
          .get()

        if (existing) {
          db.update(caldavCalendars)
            .set({
              googleAccountId: accountId,
              displayName: remoteCal.summary ?? existing.displayName,
              color: remoteCal.backgroundColor ?? existing.color,
              updatedAt: now,
              lastSyncedAt: now,
            })
            .where(eq(caldavCalendars.id, existing.id))
            .run()

          if (existing.enabled) {
            await this.syncCalendarEvents(existing.id, remoteCal.id, calendar)
          }
        } else {
          const id = crypto.randomUUID()
          db.insert(caldavCalendars)
            .values({
              id,
              accountId: null, // Not a CalDAV account
              googleAccountId: accountId,
              remoteUrl,
              displayName: remoteCal.summary ?? 'Unnamed Calendar',
              color: remoteCal.backgroundColor ?? null,
              ctag: null,
              syncToken: null,
              timezone: remoteCal.timeZone ?? null,
              enabled: true,
              lastSyncedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .run()

          await this.syncCalendarEvents(id, remoteCal.id, calendar)
        }
      }

      // Remove calendars no longer on Google for this account
      const localCalendars = db
        .select()
        .from(caldavCalendars)
        .where(eq(caldavCalendars.googleAccountId, accountId))
        .all()

      for (const local of localCalendars) {
        if (!seenRemoteUrls.has(local.remoteUrl)) {
          db.delete(caldavEvents).where(eq(caldavEvents.calendarId, local.id)).run()
          db.delete(caldavCalendars).where(eq(caldavCalendars.id, local.id)).run()
          logger.info('Removed deleted Google calendar', {
            displayName: local.displayName,
            accountId,
          })
        }
      }

      // Update sync time
      db.update(googleAccounts)
        .set({
          lastCalendarSyncAt: now,
          lastCalendarSyncError: null,
          updatedAt: now,
        })
        .where(eq(googleAccounts.id, accountId))
        .run()

      if (conn) {
        conn.lastSyncError = null
      }

      logger.info('Google Calendar sync complete', {
        accountId,
        calendars: remoteCalendars.length,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (conn) conn.lastSyncError = errorMsg

      db.update(googleAccounts)
        .set({
          lastCalendarSyncError: errorMsg,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(googleAccounts.id, accountId))
        .run()

      throw err
    } finally {
      if (conn) conn.isSyncing = false
    }
  }

  private async syncCalendarEvents(
    localCalendarId: string,
    googleCalendarId: string,
    calendar: calendar_v3.Calendar
  ): Promise<void> {
    // Fetch events from now - 30 days to now + 365 days
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 30)
    const timeMax = new Date()
    timeMax.setFullYear(timeMax.getFullYear() + 1)

    const now = new Date().toISOString()
    const seenUrls = new Set<string>()

    let pageToken: string | undefined
    do {
      const res = await calendar.events.list({
        calendarId: googleCalendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken,
      })

      const events = res.data.items ?? []

      for (const event of events) {
        if (!event.id) continue

        const remoteUrl = `google-event://${googleCalendarId}/${event.id}`
        seenUrls.add(remoteUrl)

        const eventData = this.mapGoogleEvent(event)

        const existing = db
          .select()
          .from(caldavEvents)
          .where(eq(caldavEvents.remoteUrl, remoteUrl))
          .get()

        if (existing) {
          db.update(caldavEvents)
            .set({ ...eventData, updatedAt: now })
            .where(eq(caldavEvents.id, existing.id))
            .run()
        } else {
          db.insert(caldavEvents)
            .values({
              id: crypto.randomUUID(),
              calendarId: localCalendarId,
              remoteUrl,
              ...eventData,
              createdAt: now,
              updatedAt: now,
            })
            .run()
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)

    // Remove events no longer on Google
    const localEvents = db
      .select()
      .from(caldavEvents)
      .where(eq(caldavEvents.calendarId, localCalendarId))
      .all()

    for (const local of localEvents) {
      if (!seenUrls.has(local.remoteUrl)) {
        db.delete(caldavEvents).where(eq(caldavEvents.id, local.id)).run()
      }
    }
  }

  /**
   * Create an event on a Google Calendar.
   * Returns the remote URL of the created event.
   */
  async createEvent(
    calendarDbId: string,
    event: {
      summary: string
      dtstart: string
      dtend?: string
      description?: string
      location?: string
      allDay?: boolean
    }
  ): Promise<string> {
    const cal = db
      .select()
      .from(caldavCalendars)
      .where(eq(caldavCalendars.id, calendarDbId))
      .get()

    if (!cal?.googleAccountId) {
      throw new Error('Calendar is not a Google Calendar')
    }

    const googleCalendarId = this.extractGoogleCalendarId(cal.remoteUrl)
    const auth = await getAuthenticatedClient(cal.googleAccountId)
    const calendar = google.calendar({ version: 'v3', auth })

    const eventBody: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      location: event.location,
    }

    if (event.allDay) {
      eventBody.start = { date: event.dtstart.split('T')[0] }
      eventBody.end = { date: (event.dtend ?? event.dtstart).split('T')[0] }
    } else {
      eventBody.start = { dateTime: event.dtstart }
      eventBody.end = { dateTime: event.dtend ?? event.dtstart }
    }

    const res = await calendar.events.insert({
      calendarId: googleCalendarId,
      requestBody: eventBody,
    })

    const now = new Date().toISOString()
    const remoteUrl = `google-event://${googleCalendarId}/${res.data.id}`

    // Insert local copy
    db.insert(caldavEvents)
      .values({
        id: crypto.randomUUID(),
        calendarId: calendarDbId,
        remoteUrl,
        uid: res.data.iCalUID ?? null,
        etag: res.data.etag ?? null,
        summary: event.summary,
        description: event.description ?? null,
        location: event.location ?? null,
        dtstart: event.dtstart,
        dtend: event.dtend ?? null,
        duration: null,
        allDay: event.allDay ?? false,
        recurrenceRule: null,
        status: 'confirmed',
        organizer: null,
        attendees: null,
        rawIcal: null,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    return remoteUrl
  }

  /**
   * Update an event on a Google Calendar.
   */
  async updateEvent(
    eventDbId: string,
    updates: {
      summary?: string
      dtstart?: string
      dtend?: string
      description?: string
      location?: string
      allDay?: boolean
    }
  ): Promise<void> {
    const event = db
      .select()
      .from(caldavEvents)
      .where(eq(caldavEvents.id, eventDbId))
      .get()

    if (!event) throw new Error('Event not found')

    const cal = db
      .select()
      .from(caldavCalendars)
      .where(eq(caldavCalendars.id, event.calendarId))
      .get()

    if (!cal?.googleAccountId) {
      throw new Error('Calendar is not a Google Calendar')
    }

    const googleCalendarId = this.extractGoogleCalendarId(cal.remoteUrl)
    const googleEventId = this.extractGoogleEventId(event.remoteUrl)
    const auth = await getAuthenticatedClient(cal.googleAccountId)
    const calendar = google.calendar({ version: 'v3', auth })

    const isAllDay = updates.allDay ?? event.allDay ?? false
    const eventBody: calendar_v3.Schema$Event = {}

    if (updates.summary !== undefined) eventBody.summary = updates.summary
    if (updates.description !== undefined) eventBody.description = updates.description
    if (updates.location !== undefined) eventBody.location = updates.location

    if (updates.dtstart || updates.allDay !== undefined) {
      const dtstart = updates.dtstart ?? event.dtstart ?? new Date().toISOString()
      if (isAllDay) {
        eventBody.start = { date: dtstart.split('T')[0] }
      } else {
        eventBody.start = { dateTime: dtstart }
      }
    }

    if (updates.dtend || updates.allDay !== undefined) {
      const dtend = updates.dtend ?? event.dtend ?? updates.dtstart ?? event.dtstart ?? new Date().toISOString()
      if (isAllDay) {
        eventBody.end = { date: dtend.split('T')[0] }
      } else {
        eventBody.end = { dateTime: dtend }
      }
    }

    await calendar.events.patch({
      calendarId: googleCalendarId,
      eventId: googleEventId,
      requestBody: eventBody,
    })

    // Update local copy
    const now = new Date().toISOString()
    db.update(caldavEvents)
      .set({
        summary: updates.summary ?? event.summary,
        description: updates.description ?? event.description,
        location: updates.location ?? event.location,
        dtstart: updates.dtstart ?? event.dtstart,
        dtend: updates.dtend ?? event.dtend,
        allDay: updates.allDay ?? event.allDay,
        updatedAt: now,
      })
      .where(eq(caldavEvents.id, eventDbId))
      .run()
  }

  /**
   * Delete an event from a Google Calendar.
   */
  async deleteEvent(eventDbId: string): Promise<void> {
    const event = db
      .select()
      .from(caldavEvents)
      .where(eq(caldavEvents.id, eventDbId))
      .get()

    if (!event) throw new Error('Event not found')

    const cal = db
      .select()
      .from(caldavCalendars)
      .where(eq(caldavCalendars.id, event.calendarId))
      .get()

    if (!cal?.googleAccountId) {
      throw new Error('Calendar is not a Google Calendar')
    }

    const googleCalendarId = this.extractGoogleCalendarId(cal.remoteUrl)
    const googleEventId = this.extractGoogleEventId(event.remoteUrl)
    const auth = await getAuthenticatedClient(cal.googleAccountId)
    const calendar = google.calendar({ version: 'v3', auth })

    await calendar.events.delete({
      calendarId: googleCalendarId,
      eventId: googleEventId,
    })

    db.delete(caldavEvents).where(eq(caldavEvents.id, eventDbId)).run()
  }

  private mapGoogleEvent(event: calendar_v3.Schema$Event) {
    const allDay = !!event.start?.date
    const dtstart = allDay ? event.start?.date : event.start?.dateTime
    const dtend = allDay ? event.end?.date : event.end?.dateTime

    return {
      uid: event.iCalUID ?? null,
      etag: event.etag ?? null,
      summary: event.summary ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
      dtstart: dtstart ?? null,
      dtend: dtend ?? null,
      duration: null,
      allDay,
      recurrenceRule: event.recurrence?.join('\n') ?? null,
      status: event.status ?? null,
      organizer: event.organizer?.email ?? null,
      attendees: event.attendees?.map((a) => a.email ?? '').filter(Boolean) ?? null,
      rawIcal: null,
    }
  }

  /**
   * Fetch events directly from Google Calendar API (no DB caching).
   * Used by the frontend for fresh data.
   */
  async fetchEventsLive(
    accountId: string,
    timeMin: string,
    timeMax: string
  ): Promise<(ReturnType<typeof this.mapGoogleEvent> & { id: string; calendarId: string; remoteUrl: string; createdAt: string; updatedAt: string })[]> {
    const auth = await getAuthenticatedClient(accountId)
    const calendar = google.calendar({ version: 'v3', auth })

    // Find enabled Google calendars for this account
    const calendars = db
      .select()
      .from(caldavCalendars)
      .where(eq(caldavCalendars.googleAccountId, accountId))
      .all()
      .filter((c) => c.enabled)

    const results: (ReturnType<typeof this.mapGoogleEvent> & { id: string; calendarId: string; remoteUrl: string; createdAt: string; updatedAt: string })[] = []
    const now = new Date().toISOString()

    for (const cal of calendars) {
      const googleCalendarId = this.extractGoogleCalendarId(cal.remoteUrl)

      let pageToken: string | undefined
      do {
        const res = await calendar.events.list({
          calendarId: googleCalendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 2500,
          pageToken,
        })

        for (const event of res.data.items ?? []) {
          if (!event.id) continue
          results.push({
            id: `live-${googleCalendarId}-${event.id}`,
            calendarId: cal.id,
            remoteUrl: `google-event://${googleCalendarId}/${event.id}`,
            ...this.mapGoogleEvent(event),
            createdAt: now,
            updatedAt: now,
          })
        }

        pageToken = res.data.nextPageToken ?? undefined
      } while (pageToken)
    }

    return results
  }

  private extractGoogleCalendarId(remoteUrl: string): string {
    // google-calendar://calendarId
    return remoteUrl.replace('google-calendar://', '')
  }

  private extractGoogleEventId(remoteUrl: string): string {
    // google-event://calendarId/eventId
    const parts = remoteUrl.replace('google-event://', '').split('/')
    return parts[parts.length - 1]
  }

  isSyncing(accountId: string): boolean {
    return this.connections.get(accountId)?.isSyncing ?? false
  }

  getLastSyncError(accountId: string): string | null {
    return this.connections.get(accountId)?.lastSyncError ?? null
  }
}

// Singleton
export const googleCalendarManager = new GoogleCalendarManager()
