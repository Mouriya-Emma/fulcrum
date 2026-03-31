import type { TerminalInfo } from '../types'

export interface ITerminalSession {
  readonly id: string
  readonly cwd: string
  readonly createdAt: number

  get name(): string
  get tabId(): string | undefined
  get positionInTab(): number

  start(): void | Promise<void>
  attach(): Promise<void>
  detach(): void
  write(data: string): void
  resize(cols: number, rows: number): void
  getBuffer(): string
  clearBuffer(): void
  getInfo(): TerminalInfo
  kill(): void
  isRunning(): boolean
  isAttached(): boolean
  rename(newName: string): void
  assignTab(tabId: string | null, positionInTab?: number): void
}
