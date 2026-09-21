import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { app } from 'electron'
import { loadSettings } from '../config'

let child: ChildProcessWithoutNullStreams | null = null
let fullscreenActive = false
let restartTimer: NodeJS.Timeout | null = null
let handler: ((active: boolean) => void) | null = null

export function parseProbeLine(line: string): boolean | null {
  const value = line.trim()
  if (value === 'F') return true
  if (value === 'N') return false
  return null
}

function scriptPath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'fullscreen-probe.ps1')
  return path.join(app.getAppPath(), 'resources', 'fullscreen-probe.ps1')
}

function emit(active: boolean): void {
  if (active === fullscreenActive) return
  fullscreenActive = active
  handler?.(active)
}

function spawnProbe(): void {
  if (child) return
  const script = scriptPath()
  if (!fs.existsSync(script)) return
  child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
    { windowsHide: true }
  )
  child.stdout.setEncoding('utf8')
  let buffer = ''
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const value = parseProbeLine(line)
      if (value !== null) emit(value)
    }
  })
  child.on('exit', () => {
    child = null
    emit(false)
    if (restartTimer) clearTimeout(restartTimer)
    restartTimer = setTimeout(() => {
      restartTimer = null
      if (isWatcherEnabled()) spawnProbe()
    }, 5000)
  })
  child.on('error', () => {
    child = null
  })
}

export function isWatcherEnabled(): boolean {
  return loadSettings().hideOnFullscreen
}

export function isFullscreenActive(): boolean {
  return fullscreenActive
}

export function shouldSuppressBall(): boolean {
  return fullscreenActive && isWatcherEnabled()
}

export function syncFullscreenWatcher(): void {
  if (isWatcherEnabled()) {
    spawnProbe()
  } else {
    stopFullscreenWatcher()
    emit(false)
  }
}

export function startFullscreenWatcher(onChange: (active: boolean) => void): void {
  handler = onChange
  syncFullscreenWatcher()
}

export function stopFullscreenWatcher(): void {
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  if (child) {
    child.removeAllListeners('exit')
    child.kill()
    child = null
  }
}
