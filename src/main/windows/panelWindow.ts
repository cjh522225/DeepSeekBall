import path from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { loadSettings } from '../config'
import { getBallWindow } from './ballWindow'
import { shouldSuppressBall } from '../services/fullscreenWatcher'

export const PANEL_WIDTH = 420
const PANEL_MAX_HEIGHT = 820
const EDGE_MARGIN = 12

let panelWindow: BrowserWindow | null = null
let hideFallback: NodeJS.Timeout | null = null

function panelBounds(): { x: number; y: number; width: number; height: number } {
  const settings = loadSettings()
  const { workArea } = screen.getPrimaryDisplay()
  const height = Math.min(PANEL_MAX_HEIGHT, workArea.height - 60)
  const y = Math.round(workArea.y + (workArea.height - height) / 2)
  const x =
    settings.ballSide === 'right'
      ? workArea.x + workArea.width - PANEL_WIDTH - EDGE_MARGIN
      : workArea.x + EDGE_MARGIN
  return { x, y, width: PANEL_WIDTH, height }
}

export function getPanelWindow(): BrowserWindow | null {
  return panelWindow
}

export function isPanelVisible(): boolean {
  return Boolean(panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible())
}

export function createPanelWindow(rendererUrl: string | null): BrowserWindow {
  const bounds = panelBounds()
  panelWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    title: 'DeepSeek Ball',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      spellcheck: false
    }
  })
  panelWindow.setAlwaysOnTop(true, 'screen-saver')
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (rendererUrl) {
    void panelWindow.loadURL(`${rendererUrl}/panel/index.html`)
  } else {
    void panelWindow.loadFile(path.join(__dirname, '../renderer/panel/index.html'))
  }
  panelWindow.on('closed', () => {
    panelWindow = null
  })
  panelWindow.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error(`[panel] ${message}`)
  })
  panelWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[panel] did-fail-load ${code} ${description}`)
  })
  return panelWindow
}

export function sendToPanel(channel: string, payload?: unknown): void {
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.webContents.send(channel, payload)
}

export function showPanel(): void {
  if (!panelWindow || panelWindow.isDestroyed()) return
  if (hideFallback) {
    clearTimeout(hideFallback)
    hideFallback = null
  }
  const bounds = panelBounds()
  panelWindow.setBounds(bounds)
  getBallWindow()?.hide()
  if (!panelWindow.isVisible()) panelWindow.show()
  panelWindow.focus()
  sendToPanel('panel:show')
}

export function hidePanel(immediate = false): void {
  if (!panelWindow || panelWindow.isDestroyed() || !panelWindow.isVisible()) return
  if (immediate) {
    finalizeHide()
    return
  }
  sendToPanel('panel:collapse-request')
  if (hideFallback) clearTimeout(hideFallback)
  hideFallback = setTimeout(() => finalizeHide(), 400)
}

export function finalizeHide(): void {
  if (hideFallback) {
    clearTimeout(hideFallback)
    hideFallback = null
  }
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.hide()
  if (shouldSuppressBall()) return
  const ball = getBallWindow()
  if (ball && !ball.isDestroyed()) {
    ball.show()
    ball.webContents.send('ball:appearance')
  }
}

export function togglePanel(): void {
  if (isPanelVisible()) hidePanel()
  else showPanel()
}

export function updatePanelBounds(): void {
  if (panelWindow && !panelWindow.isDestroyed()) panelWindow.setBounds(panelBounds())
}
