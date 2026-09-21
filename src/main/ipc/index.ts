import { app, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { dataDir } from '../appPaths'
import { getApiKey, hasApiKey, loadSettings, saveSettings, setApiKey } from '../config'
import {
  appendMessage,
  createConversation,
  deleteConversation,
  exportAllJson,
  exportConversationMarkdown,
  getConversation,
  listConversations,
  renameConversation,
  searchConversations,
  setConversationWebState,
  trimTrailingAssistant
} from '../store/conversations'
import { saveImageBase64, saveImageBuffer } from '../store/attachments'
import { runOcr } from '../services/ocr'
import {
  listModels,
  openAICompatibleProvider,
  testConnection
} from '../providers/openaiCompatible'
import {
  checkWebLogin,
  closeLoginWindow,
  deepseekWebProvider,
  openLoginWindow
} from '../providers/deepseekWeb'
import type { ChatProvider, ProviderContext } from '../providers/types'
import {
  applyBallAppearance,
  broadcastSettingsChanged,
  endBallDrag,
  setBallStreaming,
  startBallDrag
} from '../windows/ballWindow'
import {
  finalizeHide,
  isPanelVisible,
  sendToPanel,
  showPanel,
  togglePanel
} from '../windows/panelWindow'
import { closeCaptureOverlay, startCapture } from '../windows/capture'
import { getFailedHotkeys, registerShortcuts } from '../shortcuts'
import { refreshTrayMenu } from '../tray'
import { getRendererUrl } from '../runtime'
import { syncFullscreenWatcher } from '../services/fullscreenWatcher'
import {
  autoLaunchSupported,
  getAutoLaunchState,
  setAutoLaunch
} from '../services/autoLaunch'
import type {
  Attachment,
  ChatMessage,
  ChatSendPayload,
  CaptureSubmitPayload,
  PublicSettings,
  SettingsPatch
} from '../../shared/types'

interface ActiveRequest {
  controller: AbortController
  conversationId: string
  messageId: string
  content: string
  reasoning: string
  status: ChatMessage['status']
  error?: string
}

const active = new Map<string, ActiveRequest>()

function publicSettings(): Promise<PublicSettings> {
  return Promise.all([checkWebLogin(), getAutoLaunchState()]).then(([webLoggedIn, autoLaunchActive]) => ({
    ...loadSettings(),
    apiKeySet: hasApiKey(),
    webLoggedIn,
    autoLaunchActive,
    autoLaunchSupported: autoLaunchSupported(),
    version: app.getVersion(),
    failedHotkeys: getFailedHotkeys()
  }))
}

function applyTheme(): void {
  const settings = loadSettings()
  nativeTheme.themeSource = settings.theme
  const dark = nativeTheme.shouldUseDarkColors
  sendToPanel('theme:changed', dark)
}

async function runStream(requestId: string): Promise<void> {
  const entry = active.get(requestId)
  if (!entry) return
  const settings = loadSettings()
  const conversation = getConversation(entry.conversationId)
  if (!conversation) {
    active.delete(requestId)
    sendToPanel('chat:error', {
      requestId,
      conversationId: entry.conversationId,
      error: '会话不存在'
    })
    return
  }
  const provider: ChatProvider =
    settings.provider === 'web' ? deepseekWebProvider : openAICompatibleProvider
  const ctx: ProviderContext = {
    settings,
    apiKey: getApiKey(),
    messages: conversation.messages,
    signal: entry.controller.signal,
    sessionId: conversation.id,
    onChunk: (chunk) => {
      if (chunk.contentDelta) entry.content += chunk.contentDelta
      if (chunk.reasoningDelta) entry.reasoning += chunk.reasoningDelta
      sendToPanel('chat:chunk', {
        requestId,
        conversationId: entry.conversationId,
        contentDelta: chunk.contentDelta,
        reasoningDelta: chunk.reasoningDelta
      })
    },
    onWebState: (state) => {
      setConversationWebState(entry.conversationId, state.sessionId, state.parentMessageId)
    },
    web: {
      sessionId: conversation.webSessionId,
      parentMessageId: conversation.webParentMessageId
    }
  }
  try {
    await provider.stream(ctx)
    entry.status = 'done'
  } catch (error) {
    if (entry.controller.signal.aborted) {
      entry.status = 'aborted'
    } else {
      entry.status = 'error'
      entry.error = error instanceof Error ? error.message : String(error)
    }
  } finally {
    const keepMessage = entry.content.length > 0 || entry.reasoning.length > 0
    let finalMessage: ChatMessage | null = null
    if (entry.status !== 'aborted' || keepMessage) {
      finalMessage = {
        id: entry.messageId,
        role: 'assistant',
        content: entry.content,
        reasoning: entry.reasoning || undefined,
        status: entry.status,
        error: entry.error,
        createdAt: Date.now(),
        model: settings.model
      }
      appendMessage(entry.conversationId, finalMessage)
    }
    active.delete(requestId)
    if (active.size === 0) setBallStreaming(false)
    if (entry.status === 'error') {
      sendToPanel('chat:error', {
        requestId,
        conversationId: entry.conversationId,
        error: entry.error ?? '未知错误'
      })
    } else {
      const meta = listConversations().find((c) => c.id === entry.conversationId)
      sendToPanel('chat:done', {
        requestId,
        conversationId: entry.conversationId,
        message:
          finalMessage ??
          ({
            id: entry.messageId,
            role: 'assistant',
            content: '',
            status: 'aborted',
            createdAt: Date.now()
          } satisfies ChatMessage),
        title: meta?.title
      })
    }
  }
}

export function registerIpc(): void {
  ipcMain.on('ball:drag-start', () => startBallDrag())
  ipcMain.on('ball:drag-end', () => endBallDrag())
  ipcMain.on('ball:click', () => togglePanel())
  ipcMain.on('ball:context-menu', () => {
    Menu.buildFromTemplate([
      { label: isPanelVisible() ? '收起面板' : '打开面板', click: () => togglePanel() },
      {
        label: '新建会话',
        click: () => {
          showPanel()
          sendToPanel('menu', { action: 'new-conversation' })
        }
      },
      {
        label: '设置',
        click: () => {
          showPanel()
          sendToPanel('menu', { action: 'settings' })
        }
      },
      { type: 'separator' },
      { label: '截图提问', click: () => void startCapture(getRendererUrl()) },
      { label: '退出', click: () => app.quit() }
    ]).popup()
  })

  ipcMain.on('panel:hide', () => finalizeHide())

  ipcMain.handle('conv:list', () => listConversations())
  ipcMain.handle('conv:create', (_event, title?: string) => createConversation(title))
  ipcMain.handle('conv:get', (_event, id: string) => getConversation(id))
  ipcMain.handle('conv:rename', (_event, id: string, title: string) =>
    renameConversation(id, title)
  )
  ipcMain.handle('conv:remove', (_event, id: string) => deleteConversation(id))
  ipcMain.handle('conv:search', (_event, query: string) => searchConversations(query))

  ipcMain.handle('conv:export-md', async (_event, id: string) => {
    const conv = getConversation(id)
    if (!conv) return { ok: false }
    const result = await dialog.showSaveDialog({
      title: '导出会话为 Markdown',
      defaultPath: `${conv.title.replace(/[\\/:*?"<>|]/g, '_')}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    fs.writeFileSync(result.filePath, exportConversationMarkdown(id), 'utf8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle('conv:export-all', async () => {
    const result = await dialog.showSaveDialog({
      title: '导出全部会话数据',
      defaultPath: `deepseek-ball-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    fs.writeFileSync(result.filePath, exportAllJson(), 'utf8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle('chat:send', async (_event, payload: ChatSendPayload) => {
    let conversation = getConversation(payload.conversationId)
    if (!conversation) throw new Error('会话不存在')
    if (payload.regenerate) {
      trimTrailingAssistant(conversation.id)
      conversation = getConversation(conversation.id)
      if (!conversation) throw new Error('会话不存在')
    } else {
      const userMessage: ChatMessage = {
        id: randomUUID(),
        role: 'user',
        content: payload.text,
        status: 'done',
        attachments: payload.attachments?.length ? payload.attachments : undefined,
        createdAt: Date.now()
      }
      const titleHint = payload.text.trim().split('\n')[0]
      appendMessage(conversation.id, userMessage, titleHint)
    }
    const entry: ActiveRequest = {
      controller: new AbortController(),
      conversationId: conversation.id,
      messageId: randomUUID(),
      content: '',
      reasoning: '',
      status: 'streaming'
    }
    active.set(payload.requestId, entry)
    setBallStreaming(true)
    void runStream(payload.requestId)
  })

  ipcMain.on('chat:stop', (_event, requestId: string) => {
    const entry = active.get(requestId)
    if (entry) entry.controller.abort()
  })

  ipcMain.handle('settings:get', () => publicSettings())

  ipcMain.handle('settings:set', async (_event, patch: SettingsPatch) => {
    saveSettings(patch)
    registerShortcuts()
    refreshTrayMenu()
    if (
      patch.ballSize !== undefined ||
      patch.ballOpacity !== undefined ||
      patch.ballSide !== undefined
    ) {
      applyBallAppearance()
    }
    if (patch.autoLaunch !== undefined) await setAutoLaunch(patch.autoLaunch)
    if (patch.theme !== undefined) applyTheme()
    if (patch.hideOnFullscreen !== undefined) syncFullscreenWatcher()
    broadcastSettingsChanged()
    return publicSettings()
  })

  ipcMain.handle('settings:test', async () => {
    const settings = loadSettings()
    if (settings.provider === 'web') {
      const loggedIn = await checkWebLogin()
      return {
        ok: loggedIn,
        message: loggedIn ? '网页账号已登录' : '未检测到登录状态，请点击「登录网页账号」'
      }
    }
    return testConnection(settings, getApiKey())
  })

  ipcMain.handle('settings:list-models', () =>
    listModels(loadSettings(), getApiKey())
  )

  ipcMain.handle('settings:import-opencode-key', async () => {
    try {
      const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json')
      if (!fs.existsSync(authPath)) {
        return { ok: false, message: '未找到 OpenCode 凭证文件（~/.local/share/opencode/auth.json）' }
      }
      const raw = JSON.parse(fs.readFileSync(authPath, 'utf8')) as Record<
        string,
        { key?: string; apiKey?: string }
      >
      const entry = raw['opencode-go'] ?? raw['deepseek']
      const label = raw['opencode-go'] ? 'OpenCode Go' : 'DeepSeek'
      const key = (entry?.key ?? entry?.apiKey ?? '').trim()
      if (!key) return { ok: false, message: 'OpenCode 凭证中没有可用密钥' }
      setApiKey(key)
      return { ok: true, message: `已导入 ${label} 密钥（DPAPI 加密存储）` }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('settings:web-login', async () => {
    openLoginWindow()
    return true
  })

  ipcMain.handle('settings:web-logout', async () => {
    closeLoginWindow()
    return true
  })

  ipcMain.on('capture:start', () => void startCapture(getRendererUrl()))
  ipcMain.on('capture:cancel', () => closeCaptureOverlay(true))
  ipcMain.on('capture:submit', async (_event, payload: CaptureSubmitPayload) => {
    const attachment = saveImageBase64(payload.pngBase64)
    closeCaptureOverlay(false)
    const settings = loadSettings()
    if (settings.imageHandling === 'vision') {
      showPanel()
      sendToPanel('composer:insert', { attachment, mode: 'attach' })
      return
    }
    const result = await runOcr(attachment.filePath)
    showPanel()
    if (result.ok) {
      const withText: Attachment = { ...attachment, ocrText: result.text }
      sendToPanel('composer:insert', { text: result.text, attachment: withText, mode: 'quote' })
    } else {
      sendToPanel('composer:insert', { attachment, mode: 'attach' })
      sendToPanel('toast', {
        type: 'warn',
        message: `OCR 失败：${result.message ?? '未知错误'}。已附加图片，请确认当前模型支持图片输入。`
      })
    }
  })

  ipcMain.handle('attach:save-buffer', (_event, payload: { bytes: Uint8Array; mime: string }) =>
    saveImageBuffer(payload.bytes, payload.mime)
  )

  ipcMain.handle('ocr:run', (_event, filePath: string) => runOcr(filePath))

  ipcMain.on('app:open-data-dir', () => void shell.openPath(dataDir()))

  ipcMain.handle('app:set-auto-launch', async (_event, enabled: boolean) => {
    saveSettings({ autoLaunch: enabled })
    return setAutoLaunch(enabled)
  })

  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.on('app:quit', () => app.quit())
}

export function abortAllRequests(): void {
  for (const entry of active.values()) entry.controller.abort()
  active.clear()
}

export function hasActiveRequests(): boolean {
  return active.size > 0
}

export function dataDirectory(): string {
  return dataDir()
}
