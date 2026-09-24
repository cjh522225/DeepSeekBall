import { app, BrowserWindow, Menu, nativeTheme, net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { configureUserData } from './appPaths'
import { loadSettings } from './config'
import { isInsideDataDir } from './store/attachments'
import { abortAllRequests, registerIpc } from './ipc'
import { mcpManager } from './mcp/McpManager'
import { applyBallAppearance, createBallWindow, getBallWindow } from './windows/ballWindow'
import { createPanelWindow, finalizeHide, getPanelWindow, showPanel } from './windows/panelWindow'
import { createTray, destroyTray } from './tray'
import { registerShortcuts, unregisterAllShortcuts } from './shortcuts'
import { setRendererUrl } from './runtime'
import {
  startFullscreenWatcher,
  stopFullscreenWatcher
} from './services/fullscreenWatcher'
import { syncAutoLaunch } from './services/autoLaunch'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

configureUserData()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'dsfile',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let quitting = false

app.on('second-instance', () => {
  showPanel()
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  app.setAppUserModelId('com.hwq.deepseekball')

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'] ?? null
  setRendererUrl(rendererUrl)

  protocol.handle('dsfile', (request) => {
    try {
      const url = new URL(request.url)
      const host = url.hostname
      const pathname = decodeURIComponent(url.pathname)
      const filePath =
        host.length === 1 ? `${host.toUpperCase()}:${pathname}` : pathname.replace(/^\//, '')
      if (!isInsideDataDir(filePath)) {
        console.error(`[dsfile] forbidden url=${request.url} path=${filePath}`)
        return new Response('forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      console.error(`[dsfile] bad request url=${request.url} ${String(error)}`)
      return new Response('bad request', { status: 400 })
    }
  })

  registerIpc()

  const settings = loadSettings()
  nativeTheme.themeSource = settings.theme
  nativeTheme.on('updated', () => {
    getPanelWindow()?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors)
  })

  createBallWindow(rendererUrl)
  createPanelWindow(rendererUrl)
  createTray()
  registerShortcuts()
  applyBallAppearance()

  getPanelWindow()?.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      finalizeHide()
    }
  })
  getBallWindow()?.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      getBallWindow()?.hide()
    }
  })

  app.on('activate', () => showPanel())

  void syncAutoLaunch()
  void mcpManager.refresh()

  startFullscreenWatcher((active) => {
    const ball = getBallWindow()
    if (active) {
      ball?.hide()
      if (!quitting) finalizeHide()
    } else if (ball && !ball.isDestroyed()) {
      ball.show()
      ball.webContents.send('ball:appearance')
    }
  })
})

app.on('before-quit', () => {
  quitting = true
  abortAllRequests()
  void mcpManager.disconnectAll()
  unregisterAllShortcuts()
  stopFullscreenWatcher()
  destroyTray()
})

app.on('window-all-closed', () => {
  void 0
})

export type { BrowserWindow }
