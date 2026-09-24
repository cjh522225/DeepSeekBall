import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { dataDir } from './appPaths'
import type { Settings, SettingsPatch } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  provider: 'official',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 1,
  systemPrompt: '',
  maxContextMessages: 30,
  imageHandling: 'ocr',
  theme: 'system',
  showReasoning: true,
  ballSize: 64,
  ballOpacity: 1,
  ballSide: 'right',
  ballY: -1,
  hideOnFullscreen: true,
  hotkeys: {
    togglePanel: 'Alt+Space',
    screenshot: 'Alt+Shift+A',
    clipboard: 'Alt+Shift+Q'
  },
  autoLaunch: false,
  mcpServers: [],
  localTools: {
    enabled: false,
    roots: [],
    allowCommands: true
  },
  agentMode: 'build'
}

let cached: Settings | null = null
let cachedSecrets: { apiKey?: string } | null = null

const configPath = (): string => path.join(dataDir(), 'config.json')
const secretsPath = (): string => path.join(dataDir(), 'secrets.json')

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

export function loadSettings(): Settings {
  if (cached) return cached
  const fromDisk = readJson<Partial<Settings>>(configPath())
  cached = { ...DEFAULT_SETTINGS, ...(fromDisk ?? {}) }
  cached.hotkeys = { ...DEFAULT_SETTINGS.hotkeys, ...(fromDisk?.hotkeys ?? {}) }
  cached.localTools = {
    ...DEFAULT_SETTINGS.localTools,
    ...(fromDisk?.localTools ?? {}),
    roots: [...(fromDisk?.localTools?.roots ?? DEFAULT_SETTINGS.localTools.roots)]
  }
  return cached
}

export function saveSettings(patch: SettingsPatch): Settings {
  const { apiKey, ...rest } = patch
  if (apiKey !== undefined) setApiKey(apiKey)
  const current = loadSettings()
  cached = {
    ...current,
    ...rest,
    hotkeys: { ...current.hotkeys, ...(rest.hotkeys ?? {}) },
    localTools: {
      ...current.localTools,
      ...(rest.localTools ?? {}),
      roots: [...((rest.localTools ?? current.localTools).roots ?? [])]
    }
  }
  writeJsonAtomic(configPath(), cached)
  return cached
}

export function getApiKey(): string {
  if (cachedSecrets) return cachedSecrets.apiKey ?? ''
  const raw = readJson<{ apiKey?: string; encrypted?: boolean }>(secretsPath())
  if (!raw?.apiKey) {
    cachedSecrets = {}
    return ''
  }
  let apiKey = ''
  if (raw.encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(raw.apiKey, 'base64'))
    } catch {
      apiKey = ''
    }
  } else {
    apiKey = Buffer.from(raw.apiKey, 'base64').toString('utf8')
  }
  cachedSecrets = { apiKey }
  return apiKey
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    cachedSecrets = {}
    writeJsonAtomic(secretsPath(), {})
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    writeJsonAtomic(secretsPath(), {
      apiKey: safeStorage.encryptString(trimmed).toString('base64'),
      encrypted: true
    })
  } else {
    writeJsonAtomic(secretsPath(), {
      apiKey: Buffer.from(trimmed, 'utf8').toString('base64'),
      encrypted: false
    })
  }
  cachedSecrets = { apiKey: trimmed }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
}
