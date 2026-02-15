/**
 * Email Setup Component - Configure IMAP for email receiving channel
 *
 * Email sending is disabled. Use Gmail drafts instead.
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Tick02Icon,
  Cancel01Icon,
  TestTube01Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons'
import {
  useEmailStatus,
  useConfigureEmail,
  useTestEmailCredentials,
  useEnableEmail,
  useDisableEmail,
} from '@/hooks/use-messaging'

interface EmailSetupProps {
  isLoading?: boolean
}

// Well-known email provider IMAP settings (auto-detected from email domain)
const KNOWN_PROVIDERS: Record<string, {
  imap: { host: string; port: number; secure: boolean }
  note?: string
}> = {
  'gmail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    note: 'Requires an App Password. Go to Google Account > Security > 2-Step Verification > App passwords.',
  },
  'googlemail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    note: 'Requires an App Password. Go to Google Account > Security > 2-Step Verification > App passwords.',
  },
  'outlook.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'hotmail.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'live.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'yahoo.com': {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  },
  'icloud.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    note: 'Requires an App-Specific Password from appleid.apple.com.',
  },
}

// Get provider settings from email domain, or generate defaults
function getProviderSettings(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && KNOWN_PROVIDERS[domain]) {
    return { ...KNOWN_PROVIDERS[domain], isKnown: true }
  }
  // Default: try common patterns for unknown domains
  return {
    imap: { host: `imap.${domain || 'example.com'}`, port: 993, secure: true },
    isKnown: false,
  }
}

export function EmailSetup({ isLoading = false }: EmailSetupProps) {
  const { data: status, refetch: refetchStatus } = useEmailStatus()
  const configureEmail = useConfigureEmail()
  const testCredentials = useTestEmailCredentials()
  const enableEmailMutation = useEnableEmail()
  const disableEmailMutation = useDisableEmail()

  // Check if credentials are already configured (have host values)
  const hasCredentials = !!status?.config?.imap?.host

  // Form state - simplified to just email + password
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [imapSecure, setImapSecure] = useState(true)
  const [imapUser, setImapUser] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [pollInterval, setPollInterval] = useState(30)

  // Test results
  const [testResult, setTestResult] = useState<{
    success: boolean
    imapOk: boolean
    error?: string
  } | null>(null)

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isEnabled = status?.enabled ?? false

  // Get provider info for current email
  const providerInfo = getProviderSettings(email)

  // Initialize form from existing config
  useEffect(() => {
    if (status?.config) {
      const config = status.config
      setEmail(config.imap?.user || '')
      setPassword(config.imap?.password || '')
      setImapHost(config.imap?.host || '')
      setImapPort(config.imap?.port || 993)
      setImapSecure(config.imap?.secure ?? true)
      setImapUser(config.imap?.user || '')
      setImapPassword(config.imap?.password || '')  // Will be '••••••••' if set
      setPollInterval(config.pollIntervalSeconds || 30)
      // Show advanced if custom settings were used
      const detected = getProviderSettings(config.imap?.user || '')
      if (config.imap?.host && config.imap.host !== detected.imap.host) {
        setShowAdvanced(true)
      }
    }
  }, [status?.config])

  const buildCredentials = () => {
    if (showAdvanced) {
      // Advanced mode: use custom IMAP credentials
      return {
        imap: {
          host: imapHost,
          port: imapPort,
          secure: imapSecure,
          user: imapUser,
          password: imapPassword,
        },
        pollIntervalSeconds: pollInterval,
      }
    }

    // Simple mode: same email/password, auto-detected servers
    return {
      imap: {
        ...providerInfo.imap,
        user: email,
        password,
      },
      pollIntervalSeconds: pollInterval,
    }
  }

  const handleTest = async () => {
    const creds = buildCredentials()
    setTestResult(null)
    try {
      const result = await testCredentials.mutateAsync(creds)
      setTestResult(result)
      if (result.success) {
        toast.success('Connection test successful')
      } else {
        toast.error(result.error || 'Connection test failed')
      }
    } catch {
      toast.error('Failed to test credentials')
    }
  }

  const handleConfigure = async () => {
    const creds = buildCredentials()
    try {
      await configureEmail.mutateAsync(creds)
      toast.success('Email configured successfully')
      setPassword('') // Clear password from form
      refetchStatus()
    } catch {
      toast.error('Failed to configure email')
    }
  }

  const handleEnable = async () => {
    try {
      const result = await enableEmailMutation.mutateAsync()
      if (result) {
        toast.success('Email enabled')
        refetchStatus()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable email')
    }
  }

  const handleDisable = async () => {
    try {
      await disableEmailMutation.mutateAsync()
      toast.success('Email disabled')
      refetchStatus()
    } catch {
      toast.error('Failed to disable email')
    }
  }

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      if (hasCredentials) {
        // Use existing credentials
        await handleEnable()
      }
      // If no credentials, the form will be shown for user to fill
    } else {
      await handleDisable()
    }
  }

  const isPending =
    configureEmail.isPending ||
    testCredentials.isPending ||
    enableEmailMutation.isPending ||
    disableEmailMutation.isPending

  const getStatusIcon = () => {
    if (isConnected) {
      return (
        <HugeiconsIcon
          icon={Tick02Icon}
          size={14}
          strokeWidth={2}
          className="text-green-500"
        />
      )
    }
    if (isConnecting) {
      return (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={14}
          strokeWidth={2}
          className="animate-spin text-yellow-500"
        />
      )
    }
    return (
      <HugeiconsIcon
        icon={Cancel01Icon}
        size={14}
        strokeWidth={2}
        className="text-muted-foreground"
      />
    )
  }

  const getStatusText = () => {
    if (isConnected) {
      return status?.displayName ? `Connected as ${status.displayName}` : 'Connected'
    }
    if (isConnecting) return 'Connecting...'
    if (status?.status === 'credentials_required') return 'Credentials required'
    return 'Disconnected'
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle and status */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
          Email (Receive Only)
        </label>
        <div className="flex items-center gap-3">
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading || isPending}
          />
          <span className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className="text-muted-foreground">{getStatusText()}</span>
          </span>
        </div>
      </div>

      {/* Configuration form (shown when not connected) */}
      {!isConnected && (
        <div className="ml-4 sm:ml-44 space-y-4 max-w-md">
          {/* Simple mode: Email address and password (hidden in advanced mode) */}
          {!showAdvanced && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="assistant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {providerInfo.note && email.includes('@') && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      size={14}
                      strokeWidth={2}
                      className="shrink-0 mt-0.5 text-yellow-500"
                    />
                    {providerInfo.note}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {email.includes('@gmail.com') || email.includes('@icloud.com') ? 'App Password' : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Server info (auto-detected) */}
              {email.includes('@') && (
                <div className="text-xs text-muted-foreground">
                  <span>IMAP: {providerInfo.imap.host}:{providerInfo.imap.port}</span>
                  {!providerInfo.isKnown && (
                    <span className="ml-2 text-yellow-600">(auto-detected)</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Advanced settings toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? '- Hide advanced settings' : '+ Show advanced settings'}
            </button>
          </div>

          {/* Advanced: Custom IMAP server settings */}
          {showAdvanced && (
            <>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">IMAP Settings (Incoming)</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="imapHost">Host</Label>
                      <Input
                        id="imapHost"
                        placeholder="imap.gmail.com"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imapPort">Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        value={imapPort || providerInfo.imap.port}
                        onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                      <Switch
                        id="imapSecure"
                        checked={imapSecure}
                        onCheckedChange={setImapSecure}
                      />
                      <Label htmlFor="imapSecure">SSL/TLS</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imapUser">Username</Label>
                    <Input
                      id="imapUser"
                      placeholder="you@gmail.com"
                      value={imapUser}
                      onChange={(e) => setImapUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imapPassword">Password</Label>
                    <Input
                      id="imapPassword"
                      type="password"
                      placeholder="IMAP password or app password"
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Poll interval */}
              <div className="space-y-2">
                <Label htmlFor="pollInterval">Check for new emails every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pollInterval"
                    type="number"
                    className="w-20"
                    min={10}
                    max={300}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(parseInt(e.target.value) || 30)}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={testResult.success ? Tick02Icon : Cancel01Icon}
                  size={16}
                  strokeWidth={2}
                />
                <span>{testResult.success ? 'Connection successful' : 'Connection failed'}</span>
              </div>
              {!testResult.success && testResult.error && (
                <p className="mt-1 text-xs">{testResult.error}</p>
              )}
              <div className="mt-2 text-xs space-y-1">
                <p>
                  IMAP: {testResult.imapOk ? 'OK' : 'Failed'}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isPending || (showAdvanced
                ? !imapHost || !imapUser || !imapPassword
                : !email || !password)}
            >
              {testCredentials.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : (
                <HugeiconsIcon
                  icon={TestTube01Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2"
                />
              )}
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleConfigure}
              disabled={isPending || (showAdvanced
                ? !imapHost || !imapUser || !imapPassword
                : !email || !password)}
            >
              {configureEmail.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : null}
              Save & Enable
            </Button>
          </div>
        </div>
      )}

      {/* Connected state - show sessions and disable button */}
      {isEnabled && isConnected && (
        <div className="ml-4 sm:ml-44 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={isPending}
          >
            Disable Email
          </Button>

        </div>
      )}

      {/* Help text */}
      <p className="ml-4 sm:ml-44 text-xs text-muted-foreground">
        Incoming emails are processed as observe-only (creating tasks and memories, no auto-responses).
        Email sending is disabled — use Gmail drafts instead.
      </p>
    </div>
  )
}
