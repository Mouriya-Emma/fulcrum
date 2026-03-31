import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'

// Mock ssh2 FIRST - must match the mock in hosts.test.ts
class MockClient {
  _sock = { destroyed: false, writable: true }
  _handlers = new Map<string, (...args: unknown[]) => void>()

  on(event: string, handler: (...args: unknown[]) => void) {
    this._handlers.set(event, handler)
    return this
  }

  connect(_config: unknown) {
    const readyHandler = this._handlers.get('ready')
    if (readyHandler) {
      setTimeout(() => readyHandler(), 0)
    }
  }

  end() {}

  exec(cmd: string, cb: (err: Error | null, stream: unknown) => void) {
    const stream = {
      on(event: string, handler: (...args: unknown[]) => void) {
        if (event === 'data') setTimeout(() => handler(Buffer.from('ok')), 0)
        if (event === 'close') setTimeout(() => handler(0), 5)
        return stream
      },
      stderr: { on() { return this } },
    }
    cb(null, stream)
  }

  shell(opts: unknown, cb: (err: Error | null, stream: unknown) => void) {
    cb(null, { on() { return this }, write() {}, close() {}, stderr: { on() { return this } }, setWindow() {} })
  }
}

mock.module('ssh2', () => ({ Client: MockClient }))

import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'
import { SSHConnectionManager, type SSHConnectionConfig, resetSSHConnectionManager } from './ssh-connection-manager'

const testConfig: SSHConnectionConfig = {
  host: '192.168.1.100',
  port: 22,
  username: 'testuser',
  authMethod: 'password',
  password: 'testpass',
}

describe('SSHConnectionManager', () => {
  let testEnv: TestEnv
  let manager: SSHConnectionManager

  beforeEach(() => {
    testEnv = setupTestEnv()
    resetSSHConnectionManager()
    manager = new SSHConnectionManager()
  })

  afterEach(() => {
    manager.destroyAll()
    testEnv.cleanup()
  })

  describe('getConnection', () => {
    test('creates new SSH connection', async () => {
      const client = await manager.getConnection(testConfig)
      expect(client).toBeDefined()
    })

    test('reuses idle connections from pool', async () => {
      const client1 = await manager.getConnection(testConfig)
      manager.releaseConnection(testConfig, client1)

      const client2 = await manager.getConnection(testConfig)
      expect(client2).toBe(client1)
    })

    test('creates separate connections for different hosts', async () => {
      const config2: SSHConnectionConfig = { ...testConfig, host: '192.168.1.200' }
      const client1 = await manager.getConnection(testConfig)
      const client2 = await manager.getConnection(config2)
      expect(client1).not.toBe(client2)
    })

    test('creates new connection when all pooled are in use', async () => {
      const client1 = await manager.getConnection(testConfig)
      const client2 = await manager.getConnection(testConfig)
      expect(client1).not.toBe(client2)
    })

    test('throws when pool is exhausted (max 3)', async () => {
      await manager.getConnection(testConfig)
      await manager.getConnection(testConfig)
      await manager.getConnection(testConfig)
      expect(manager.getConnection(testConfig)).rejects.toThrow('pool exhausted')
    })
  })

  describe('releaseConnection', () => {
    test('marks connection as available for reuse', async () => {
      const client = await manager.getConnection(testConfig)
      manager.releaseConnection(testConfig, client)
      const client2 = await manager.getConnection(testConfig)
      expect(client2).toBe(client)
    })
  })

  describe('testConnection', () => {
    test('returns success for valid connection', async () => {
      const result = await manager.testConnection(testConfig)
      expect(result.success).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    test('returns error for invalid auth config', async () => {
      const badConfig: SSHConnectionConfig = {
        host: '192.168.1.100',
        port: 22,
        username: 'test',
        authMethod: 'key',
        // No privateKeyPath at all
      }
      const result = await manager.testConnection(badConfig)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('execCommand', () => {
    test('executes command and returns stdout', async () => {
      const result = await manager.execCommand(testConfig, 'echo hello')
      expect(result).toBe('ok')
    })
  })

  describe('destroyAll', () => {
    test('cleans up all connections', async () => {
      await manager.getConnection(testConfig)
      manager.destroyAll()
      const client = await manager.getConnection(testConfig)
      expect(client).toBeDefined()
      manager.destroyAll()
    })
  })

  describe('health check', () => {
    test('skips unhealthy connections when getting from pool', async () => {
      const client1 = await manager.getConnection(testConfig)
      manager.releaseConnection(testConfig, client1)

      // Mark as unhealthy
      ;(client1 as { _sock: { destroyed: boolean } })._sock.destroyed = true

      const client2 = await manager.getConnection(testConfig)
      expect(client2).not.toBe(client1)
      manager.destroyAll()
    })
  })
})
