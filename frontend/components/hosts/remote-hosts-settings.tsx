import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Tick02Icon,
  Cancel01Icon,
  Delete02Icon,
  Add01Icon,
  Alert02Icon,
  TestTube01Icon,
  Edit02Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import {
  useHosts,
  useCreateHost,
  useUpdateHost,
  useDeleteHost,
  useTestHostConnection,
  useCheckHostEnv,
  useResetHostFingerprint,
  type EnvCheckResult,
} from '@/hooks/use-hosts'
import type { Host } from '@/types'

function StatusDot({ status }: { status: Host['status'] }) {
  if (status === 'connected') {
    return <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Connected" />
  }
  if (status === 'error') {
    return <span className="inline-block h-2 w-2 rounded-full bg-red-500" title="Error" />
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Unknown" />
}

function EnvChecks({ result }: { result: EnvCheckResult }) {
  const required = ['dtach', 'fulcrum']
  const optional = ['claude', 'opencode']

  return (
    <div className="mt-2 space-y-1 text-xs">
      {[...required, ...optional].map((name) => {
        const check = result.checks[name]
        if (!check) return null
        const isRequired = required.includes(name)
        return (
          <div key={name} className="flex items-center gap-2">
            {check.installed ? (
              <HugeiconsIcon icon={Tick02Icon} size={12} className="text-green-500 shrink-0" />
            ) : (
              <HugeiconsIcon
                icon={isRequired ? Cancel01Icon : Alert02Icon}
                size={12}
                className={isRequired ? 'text-red-500 shrink-0' : 'text-muted-foreground shrink-0'}
              />
            )}
            <span className={check.installed ? '' : isRequired ? 'text-red-500' : 'text-muted-foreground'}>
              {name}
            </span>
            {check.version && (
              <span className="text-muted-foreground truncate">{check.version}</span>
            )}
            {!check.installed && isRequired && (
              <span className="text-red-500">required</span>
            )}
          </div>
        )
      })}
      {result.checks['directory'] && (
        <div className="flex items-center gap-2">
          {result.checks['directory'].installed ? (
            <HugeiconsIcon icon={Tick02Icon} size={12} className="text-green-500 shrink-0" />
          ) : (
            <HugeiconsIcon icon={Cancel01Icon} size={12} className="text-red-500 shrink-0" />
          )}
          <span className={result.checks['directory'].installed ? '' : 'text-red-500'}>
            directory
          </span>
          {result.checks['directory'].error && (
            <span className="text-red-500 truncate">{result.checks['directory'].error}</span>
          )}
        </div>
      )}
    </div>
  )
}

// Validation helpers
function validateHostname(hostname: string): string | null {
  if (!hostname.trim()) return 'Hostname is required'
  // Basic hostname/IP validation
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!hostnameRegex.test(hostname) && !ipRegex.test(hostname)) {
    return 'Invalid hostname or IP address'
  }
  return null
}

function validatePort(port: string): string | null {
  const portNum = parseInt(port)
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return 'Port must be between 1 and 65535'
  }
  return null
}

function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Username is required'
  return null
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required'
  return null
}

export function RemoteHostsSettings() {
  const { data: hostsList = [], isLoading } = useHosts()
  const createHost = useCreateHost()
  const updateHost = useUpdateHost()
  const deleteHost = useDeleteHost()
  const testConnection = useTestHostConnection()
  const checkEnv = useCheckHostEnv()
  const resetFingerprint = useResetHostFingerprint()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingHostId, setEditingHostId] = useState<string | null>(null)

  // Form state (shared for add and edit)
  const [formName, setFormName] = useState('')
  const [formHostname, setFormHostname] = useState('')
  const [formPort, setFormPort] = useState('22')
  const [formUsername, setFormUsername] = useState('')
  const [formKeyPath, setFormKeyPath] = useState('~/.ssh/id_ed25519')
  const [formDefaultDir, setFormDefaultDir] = useState('')
  const [formFulcrumUrl, setFormFulcrumUrl] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  // Per-host env check results
  const [envResults, setEnvResults] = useState<Record<string, EnvCheckResult>>({})
  const [testingHostId, setTestingHostId] = useState<string | null>(null)
  const [checkingEnvHostId, setCheckingEnvHostId] = useState<string | null>(null)

  function resetForm() {
    setFormName('')
    setFormHostname('')
    setFormPort('22')
    setFormUsername('')
    setFormKeyPath('~/.ssh/id_ed25519')
    setFormDefaultDir('')
    setFormFulcrumUrl('')
    setShowAddForm(false)
    setEditingHostId(null)
    setErrors({})
  }

  function populateFormForEdit(host: Host) {
    setFormName(host.name)
    setFormHostname(host.hostname)
    setFormPort(String(host.port))
    setFormUsername(host.username)
    setFormKeyPath(host.privateKeyPath || '~/.ssh/id_ed25519')
    setFormDefaultDir(host.defaultDirectory || '')
    setFormFulcrumUrl(host.fulcrumUrl || '')
    setEditingHostId(host.id)
    setShowAddForm(false)
    setErrors({})
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string | null> = {
      name: validateName(formName),
      hostname: validateHostname(formHostname),
      port: validatePort(formPort),
      username: validateUsername(formUsername),
    }
    setErrors(newErrors)
    return !Object.values(newErrors).some((e) => e !== null)
  }

  async function handleAdd() {
    if (!validateForm()) return

    try {
      const host = await createHost.mutateAsync({
        name: formName.trim(),
        hostname: formHostname.trim(),
        port: parseInt(formPort) || 22,
        username: formUsername.trim(),
        authMethod: 'key' as const,
        privateKeyPath: formKeyPath.trim() || undefined,
        defaultDirectory: formDefaultDir.trim() || undefined,
        fulcrumUrl: formFulcrumUrl.trim() || undefined,
      })
      toast.success(`Host "${host.name}" added`)
      resetForm()
    } catch (err) {
      toast.error(`Failed to add host: ${err}`)
    }
  }

  async function handleSaveEdit() {
    if (!editingHostId || !validateForm()) return

    try {
      await updateHost.mutateAsync({
        id: editingHostId,
        updates: {
          name: formName.trim(),
          hostname: formHostname.trim(),
          port: parseInt(formPort) || 22,
          username: formUsername.trim(),
          privateKeyPath: formKeyPath.trim() || undefined,
          defaultDirectory: formDefaultDir.trim() || undefined,
          fulcrumUrl: formFulcrumUrl.trim() || undefined,
        },
      })
      toast.success('Host updated')
      resetForm()
    } catch (err) {
      toast.error(`Failed to update host: ${err}`)
    }
  }

  async function handleTest(id: string) {
    setTestingHostId(id)
    try {
      const result = await testConnection.mutateAsync(id)
      if (result.success) {
        toast.success(`Connection OK (${result.latencyMs}ms)`)
      } else {
        toast.error(`Connection failed: ${result.error}`)
      }
    } catch (err) {
      toast.error(`Test failed: ${err}`)
    } finally {
      setTestingHostId(null)
    }
  }

  async function handleCheckEnv(id: string) {
    setCheckingEnvHostId(id)
    try {
      const result = await checkEnv.mutateAsync(id)
      setEnvResults((prev) => ({ ...prev, [id]: result }))
      if (result.ready) {
        toast.success('Environment ready')
      } else {
        toast.warning('Environment not ready — some required tools are missing')
      }
    } catch (err) {
      toast.error(`Environment check failed: ${err}`)
    } finally {
      setCheckingEnvHostId(null)
    }
  }

  async function handleDelete(host: Host) {
    if (!confirm(`Delete host "${host.name}"? Tasks using this host will fall back to local execution.`)) {
      return
    }
    try {
      await deleteHost.mutateAsync(host.id)
      toast.success(`Host "${host.name}" deleted`)
    } catch (err) {
      toast.error(`Failed to delete: ${err}`)
    }
  }

  async function handleResetFingerprint(host: Host) {
    if (!confirm(`Clear stored TOFU fingerprint for "${host.name}"? Next connection will accept and re-record whatever host key the server presents.`)) {
      return
    }
    try {
      await resetFingerprint.mutateAsync(host.id)
      toast.success(`Fingerprint cleared for "${host.name}"`)
    } catch (err) {
      toast.error(`Failed to reset fingerprint: ${err}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
        Loading hosts...
      </div>
    )
  }

  // Render form (shared between add and edit modes)
  function renderForm(isEdit: boolean) {
    return (
      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          {isEdit ? 'Edit Host' : 'Add Host'}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Name</label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="my-server"
              className={`h-8 text-sm ${errors.name ? 'border-red-500' : ''}`}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Hostname / IP</label>
            <Input
              value={formHostname}
              onChange={(e) => setFormHostname(e.target.value)}
              placeholder="192.168.1.100"
              className={`h-8 text-sm ${errors.hostname ? 'border-red-500' : ''}`}
            />
            {errors.hostname && <p className="text-xs text-red-500">{errors.hostname}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Username</label>
            <Input
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="user"
              className={`h-8 text-sm ${errors.username ? 'border-red-500' : ''}`}
            />
            {errors.username && <p className="text-xs text-red-500">{errors.username}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Port</label>
            <Input
              value={formPort}
              onChange={(e) => setFormPort(e.target.value)}
              placeholder="22"
              className={`h-8 text-sm ${errors.port ? 'border-red-500' : ''}`}
              type="number"
            />
            {errors.port && <p className="text-xs text-red-500">{errors.port}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Private Key Path</label>
          <Input
            value={formKeyPath}
            onChange={(e) => setFormKeyPath(e.target.value)}
            placeholder="~/.ssh/id_ed25519"
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Default Directory</label>
            <Input
              value={formDefaultDir}
              onChange={(e) => setFormDefaultDir(e.target.value)}
              placeholder="/home/user/work (optional)"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Fulcrum URL</label>
            <Input
              value={formFulcrumUrl}
              onChange={(e) => setFormFulcrumUrl(e.target.value)}
              placeholder="http://your-ip:7777 (optional)"
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URL the remote agent uses to reach this Fulcrum server
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={isEdit ? handleSaveEdit : handleAdd}
            disabled={isEdit ? updateHost.isPending : createHost.isPending}
          >
            {(isEdit ? updateHost.isPending : createHost.isPending) ? (
              <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={isEdit ? Tick02Icon : Add01Icon} size={12} />
            )}
            {isEdit ? 'Save Changes' : 'Add Host'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={resetForm}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Host list */}
      {hostsList.map((host) => (
        <div key={host.id}>
          {editingHostId === host.id ? (
            renderForm(true)
          ) : (
            <div className="rounded-md border border-border p-3 space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-2">
                <StatusDot status={host.status} />
                <span className="text-sm font-medium">{host.name}</span>
                <span className="text-xs text-muted-foreground">
                  {host.username}@{host.hostname}:{host.port}
                </span>
                <span className="text-xs rounded bg-muted px-1.5 py-0.5">
                  {host.authMethod}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => populateFormForEdit(host)}
                  >
                    <HugeiconsIcon icon={Edit02Icon} size={12} />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => handleTest(host.id)}
                    disabled={testingHostId === host.id}
                  >
                    {testingHostId === host.id ? (
                      <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={TestTube01Icon} size={12} />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => handleCheckEnv(host.id)}
                    disabled={checkingEnvHostId === host.id}
                  >
                    {checkingEnvHostId === host.id ? (
                      <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={TestTube01Icon} size={12} />
                    )}
                    Check Env
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(host)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={12} />
                  </Button>
                </div>
              </div>

              {/* Details row */}
              {(host.defaultDirectory || host.fulcrumUrl) && (
                <div className="flex gap-4 text-xs text-muted-foreground pl-4">
                  {host.defaultDirectory && <span>Dir: {host.defaultDirectory}</span>}
                  {host.fulcrumUrl && <span>URL: {host.fulcrumUrl}</span>}
                </div>
              )}

              {/* TOFU fingerprint row */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
                <span title="SSH host key fingerprint stored on first connection (Trust On First Use)">
                  Fingerprint:
                </span>
                {host.hostFingerprint ? (
                  <>
                    <code
                      className="font-mono select-all truncate max-w-[280px]"
                      title={`SHA256:${host.hostFingerprint}`}
                    >
                      SHA256:{host.hostFingerprint}
                    </code>
                    <button
                      type="button"
                      className="underline hover:text-foreground disabled:opacity-50 disabled:no-underline"
                      onClick={() => handleResetFingerprint(host)}
                      disabled={resetFingerprint.isPending}
                    >
                      Reset
                    </button>
                  </>
                ) : (
                  <span className="italic text-amber-600 dark:text-amber-500" title="No fingerprint stored — first successful connection will record one">
                    not yet recorded
                  </span>
                )}
              </div>


              {/* Env check results */}
              {envResults[host.id] && (
                <div className="pl-4">
                  <EnvChecks result={envResults[host.id]} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {hostsList.length === 0 && !showAddForm && !editingHostId && (
        <p className="text-sm text-muted-foreground">
          No remote hosts configured. Add a host to run agents on remote machines via SSH.
        </p>
      )}

      {/* Add form */}
      {showAddForm ? (
        renderForm(false)
      ) : !editingHostId && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setShowAddForm(true)}
        >
          <HugeiconsIcon icon={Add01Icon} size={12} />
          Add Host
        </Button>
      )}
    </div>
  )
}
