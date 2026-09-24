import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChatMessage, Settings } from '../src/shared/types'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsball-cfg-'))

vi.mock('electron', () => ({
  app: { getPath: () => tmpRoot, setPath: () => undefined },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, '')
  }
}))

let config: typeof import('../src/main/config')
let providers: typeof import('../src/main/providers/openaiCompatible')

function baseSettings(): Settings {
  return config.loadSettings()
}

beforeAll(async () => {
  config = await import('../src/main/config')
  providers = await import('../src/main/providers/openaiCompatible')
})

describe('config', () => {
  it('loads defaults', () => {
    const settings = baseSettings()
    expect(settings.provider).toBe('official')
    expect(settings.baseUrl).toBe('https://api.deepseek.com')
    expect(settings.model).toBe('deepseek-chat')
    expect(settings.hotkeys.togglePanel).toBe('Alt+Space')
  })

  it('saves and reloads patches including nested hotkeys', () => {
    config.saveSettings({
      model: 'deepseek-reasoner',
      hotkeys: { ...baseSettings().hotkeys, screenshot: 'Ctrl+Alt+S' }
    })
    const settings = baseSettings()
    expect(settings.model).toBe('deepseek-reasoner')
    expect(settings.hotkeys.screenshot).toBe('Ctrl+Alt+S')
    expect(settings.hotkeys.togglePanel).toBe('Alt+Space')
  })

  it('stores api keys encrypted inside secrets.json', () => {
    config.setApiKey('sk-test-123')
    expect(config.getApiKey()).toBe('sk-test-123')
    expect(config.hasApiKey()).toBe(true)
    const raw = fs.readFileSync(path.join(tmpRoot, 'secrets.json'), 'utf8')
    expect(raw).not.toContain('sk-test-123')
    expect(raw).toContain('"encrypted": true')
    config.setApiKey('')
    expect(config.hasApiKey()).toBe(false)
  })
})

describe('buildApiMessages', () => {
  function msg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: Math.random().toString(36).slice(2),
      role,
      content,
      status: 'done',
      createdAt: Date.now(),
      ...extra
    }
  }

  it('prepends the system prompt and skips failed messages', () => {
    const settings = { ...baseSettings(), systemPrompt: '你是助手', imageHandling: 'ocr' as const }
    const result = providers.buildApiMessages(settings, [
      msg('user', '你好'),
      msg('assistant', '', { status: 'error', error: 'boom' }),
      msg('assistant', '你好呀')
    ]) as Array<{ role: string; content: unknown }>
      expect(result[0].role).toBe('system')
      expect(String(result[0].content)).toContain('你是助手')
      expect(String(result[0].content)).toContain('Build（构建）模式')
      expect(result).toHaveLength(3)
      expect(result[2].role).toBe('assistant')
  })

  it('limits context by maxContextMessages', () => {
    const settings = { ...baseSettings(), systemPrompt: '', maxContextMessages: 2 }
    const history: ChatMessage[] = []
    for (let i = 0; i < 6; i += 1) history.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m${i}`))
      const result = providers.buildApiMessages(settings, history) as Array<{ content: unknown }>
      expect(result).toHaveLength(3)
      expect(result[1].content).toBe('m4')
      expect(result[2].content).toBe('m5')
  })

  it('attaches images only in vision mode', () => {
    const imagePath = path.join(tmpRoot, 'img.png')
    fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const attachment = { id: 'a1', type: 'image' as const, filePath: imagePath }
    const withImage = msg('user', '看图', { attachments: [attachment] })

      const ocrSettings = { ...baseSettings(), systemPrompt: '', imageHandling: 'ocr' as const }
      const ocrResult = providers.buildApiMessages(ocrSettings, [withImage]) as Array<{ content: unknown }>
      expect(typeof ocrResult[1].content).toBe('string')

      const visionSettings = { ...baseSettings(), systemPrompt: '', imageHandling: 'vision' as const }
      const visionResult = providers.buildApiMessages(visionSettings, [withImage]) as Array<{
        content: Array<Record<string, unknown>>
      }>
      expect(Array.isArray(visionResult[1].content)).toBe(true)
      expect(visionResult[1].content[0].type).toBe('image_url')
      expect(visionResult[1].content[1]).toEqual({ type: 'text', text: '看图' })
  })
})

describe('opencode go headers', () => {
  it('adds routing headers only for opencode.ai endpoints', () => {
    const deepseek = { ...baseSettings(), baseUrl: 'https://api.deepseek.com' }
    expect(providers.buildRequestHeaders(deepseek, 'conv-1')).toEqual({})

    const go = { ...baseSettings(), baseUrl: 'https://opencode.ai/zen/go/v1' }
    const headers = providers.buildRequestHeaders(go, 'conv-1')
    expect(headers['x-opencode-session']).toBe('conv-1')
    expect(headers['x-opencode-client']).toBe(providers.OPENCODE_CLIENT)
    expect(headers['x-opencode-request']).toBeTruthy()
  })

  it('generates a session id when none is provided', () => {
    const go = { ...baseSettings(), baseUrl: 'https://opencode.ai/zen/go/v1' }
    const headers = providers.buildRequestHeaders(go)
    expect(headers['x-opencode-session']).toHaveLength(36)
  })
})
