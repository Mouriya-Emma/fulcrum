import { defineCommand } from 'citty'
import { FulcrumClient, type CreateHostInput } from '../client'
import { output, isJsonOutput } from '../utils/output'
import { CliError, ExitCodes } from '../utils/errors'
import { globalArgs, toFlags, setupJsonOutput } from './shared'
import type { Host } from '@shared/types'

function statusGlyph(status: Host['status']): string {
  if (status === 'connected') return '✓'
  if (status === 'error') return '✗'
  return '?'
}

function findHostByName(hosts: Host[], name: string): Host | undefined {
  return hosts.find((h) => h.name === name)
}

async function resolveHostByName(client: FulcrumClient, name: string): Promise<Host> {
  const hosts = await client.listHosts()
  const host = findHostByName(hosts, name)
  if (!host) {
    throw new CliError(
      'HOST_NOT_FOUND',
      `Host "${name}" not found. Run "fulcrum hosts list" to see configured hosts.`,
      ExitCodes.INVALID_ARGS
    )
  }
  return host
}

async function handleList(client: FulcrumClient) {
  const hosts = await client.listHosts()
  if (isJsonOutput()) {
    output(hosts)
    return
  }

  if (hosts.length === 0) {
    console.log('No remote hosts configured. Use "fulcrum hosts add <name>" to add one.')
    return
  }

  console.log('Remote Hosts')
  console.log('============')
  for (const host of hosts) {
    const target = `${host.username}@${host.hostname}:${host.port}`
    const dir = host.defaultDirectory ? `  dir=${host.defaultDirectory}` : ''
    const url = host.fulcrumUrl ? `  url=${host.fulcrumUrl}` : ''
    console.log(`  ${statusGlyph(host.status)} ${host.name.padEnd(20)} ${target}${dir}${url}`)
  }
}

async function handleAdd(
  client: FulcrumClient,
  name: string,
  flags: Record<string, string>
) {
  const hostname = flags.hostname
  const username = flags.username
  if (!hostname) {
    throw new CliError('MISSING_HOSTNAME', '--hostname is required', ExitCodes.INVALID_ARGS)
  }
  if (!username) {
    throw new CliError('MISSING_USERNAME', '--username is required', ExitCodes.INVALID_ARGS)
  }

  const input: CreateHostInput = {
    name,
    hostname,
    username,
    port: flags.port ? Number(flags.port) : undefined,
    authMethod: 'key',
    privateKeyPath: flags['key-path'],
    defaultDirectory: flags.directory,
    fulcrumUrl: flags['fulcrum-url'],
  }

  if (input.port !== undefined && (Number.isNaN(input.port) || input.port < 1 || input.port > 65535)) {
    throw new CliError('INVALID_PORT', 'Port must be between 1 and 65535', ExitCodes.INVALID_ARGS)
  }

  const host = await client.createHost(input)
  if (isJsonOutput()) {
    output(host)
  } else {
    console.log(`Host "${host.name}" added (${host.username}@${host.hostname}:${host.port})`)
  }
}

async function handleRemove(client: FulcrumClient, name: string) {
  const host = await resolveHostByName(client, name)
  await client.deleteHost(host.id)
  if (isJsonOutput()) {
    output({ success: true, removed: host.name })
  } else {
    console.log(`Host "${host.name}" removed`)
  }
}

async function handleTest(client: FulcrumClient, name: string) {
  const host = await resolveHostByName(client, name)
  const result = await client.testHost(host.id)
  if (isJsonOutput()) {
    output(result)
    return
  }
  if (result.success) {
    console.log(`OK ${host.name} (${result.latencyMs ?? '?'}ms)${result.fingerprint ? `  fingerprint=SHA256:${result.fingerprint}` : ''}`)
  } else {
    console.log(`FAIL ${host.name}: ${result.error ?? 'connection failed'}`)
    process.exitCode = ExitCodes.GENERIC_ERROR
  }
}

async function handleCheckEnv(client: FulcrumClient, name: string) {
  const host = await resolveHostByName(client, name)
  const result = await client.checkHostEnv(host.id)
  if (isJsonOutput()) {
    output(result)
    return
  }
  console.log(`Environment check: ${host.name}`)
  for (const [tool, info] of Object.entries(result.checks)) {
    const glyph = info.installed ? '✓' : '✗'
    const version = info.version ? ` ${info.version}` : ''
    const err = info.error ? ` (${info.error})` : ''
    console.log(`  ${glyph} ${tool.padEnd(12)}${version}${err}`)
  }
  console.log(`Status: ${result.ready ? 'ready' : 'not ready'}`)
  if (!result.ready) {
    process.exitCode = ExitCodes.GENERIC_ERROR
  }
}

const hostsListCommand = defineCommand({
  meta: { name: 'list', description: 'List configured remote hosts' },
  args: globalArgs,
  async run({ args }) {
    setupJsonOutput(args)
    const client = new FulcrumClient(toFlags(args).url, toFlags(args).port)
    await handleList(client)
  },
})

const hostsAddCommand = defineCommand({
  meta: { name: 'add', description: 'Add a new remote host' },
  args: {
    ...globalArgs,
    name: { type: 'positional' as const, description: 'Host name (display label, must be unique)', required: true },
    hostname: { type: 'string' as const, description: 'SSH hostname or IP', required: true },
    username: { type: 'string' as const, description: 'SSH username', required: true },
    'key-path': { type: 'string' as const, description: 'Private key path (default: ~/.ssh/id_ed25519)' },
    directory: { type: 'string' as const, description: 'Default directory on remote host' },
    'fulcrum-url': { type: 'string' as const, description: 'URL the remote agent uses to reach this Fulcrum server' },
  },
  async run({ args }) {
    setupJsonOutput(args)
    const flags = toFlags(args)
    const client = new FulcrumClient(flags.url, flags.port)
    await handleAdd(client, args.name as string, flags)
  },
})

const hostsRemoveCommand = defineCommand({
  meta: { name: 'remove', description: 'Remove a remote host' },
  args: {
    ...globalArgs,
    name: { type: 'positional' as const, description: 'Host name', required: true },
  },
  async run({ args }) {
    setupJsonOutput(args)
    const flags = toFlags(args)
    const client = new FulcrumClient(flags.url, flags.port)
    await handleRemove(client, args.name as string)
  },
})

const hostsTestCommand = defineCommand({
  meta: { name: 'test', description: 'Test SSH connection to a remote host' },
  args: {
    ...globalArgs,
    name: { type: 'positional' as const, description: 'Host name', required: true },
  },
  async run({ args }) {
    setupJsonOutput(args)
    const flags = toFlags(args)
    const client = new FulcrumClient(flags.url, flags.port)
    await handleTest(client, args.name as string)
  },
})

const hostsCheckEnvCommand = defineCommand({
  meta: { name: 'check-env', description: 'Check remote environment readiness (dtach, fulcrum, agent)' },
  args: {
    ...globalArgs,
    name: { type: 'positional' as const, description: 'Host name', required: true },
  },
  async run({ args }) {
    setupJsonOutput(args)
    const flags = toFlags(args)
    const client = new FulcrumClient(flags.url, flags.port)
    await handleCheckEnv(client, args.name as string)
  },
})

export const hostsCommand = defineCommand({
  meta: { name: 'hosts', description: 'Manage remote SSH hosts' },
  args: globalArgs,
  subCommands: {
    list: hostsListCommand,
    add: hostsAddCommand,
    remove: hostsRemoveCommand,
    test: hostsTestCommand,
    'check-env': hostsCheckEnvCommand,
  },
  async run({ args }) {
    setupJsonOutput(args)
    const client = new FulcrumClient(toFlags(args).url, toFlags(args).port)
    await handleList(client)
  },
})
