import path from 'node:path'
import { BrowserWindow, desktopCapturer, screen } from 'electron'
import { getBallWindow } from './ballWindow'
import { finalizeHide, isPanelVisible, sendToPanel, showPanel } from './panelWindow'

let overlayWindow: BrowserWindow | null = null
let restoreState: { panel: boolean; ball: boolean } | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function closeOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()
  overlayWindow = null
}

export function restoreAfterCapture(): void {
  const state = restoreState
  restoreState = null
  if (!state) return
  if (state.panel) {
    showPanel()
  } else {
    const ball = getBallWindow()
    if (ball && !ball.isDestroyed()) ball.show()
  }
}

export function closeCaptureOverlay(restore: boolean): void {
  closeOverlay()
  if (restore) restoreAfterCapture()
}

export async function startCapture(rendererUrl: string | null): Promise<void> {
  if (overlayWindow && !overlayWindow.isDestroyed()) return
  const ball = getBallWindow()
  restoreState = {
    panel: isPanelVisible(),
    ball: Boolean(ball && !ball.isDestroyed() && ball.isVisible())
  }
  if (restoreState.panel) finalizeHide()
  if (restoreState.ball && ball) ball.hide()
  await delay(240)

  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const scale = display.scaleFactor || 1
  let dataUrl = ''
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale)
      }
    })
    const source =
      sources.find((s) => String(s.display_id) === String(display.id)) ??
      sources[0]
    dataUrl = source?.thumbnail.toDataURL() ?? ''
  } catch {
    dataUrl = ''
  }

  const bounds = display.bounds
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
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
    title: '截图选区',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  if (rendererUrl) {
    void overlayWindow.loadURL(`${rendererUrl}/overlay/index.html`)
  } else {
    void overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'))
  }
  overlayWindow.once('ready-to-show', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    overlayWindow.webContents.send('capture:init', {
      dataUrl,
      scaleFactor: scale,
      bounds,
      displayId: display.id
    })
    overlayWindow.show()
    overlayWindow.focus()
  })
  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

export function notifyCaptureCancelled(): void {
  sendToPanel('capture:cancelled')
}
