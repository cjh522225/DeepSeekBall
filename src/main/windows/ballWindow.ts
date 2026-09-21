import path from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { loadSettings, saveSettings } from '../config'

const SHADOW_MARGIN = 32
const MIN_BALL_SIZE = 44
const MAX_BALL_SIZE = 96

let ballWindow: BrowserWindow | null = null
let dragTimer: NodeJS.Timeout | null = null

function windowSide(): 'left' | 'right' {
  return loadSettings().ballSide
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function ballWindowSize(): number {
  return Math.round(clamp(loadSettings().ballSize, MIN_BALL_SIZE, MAX_BALL_SIZE)) + SHADOW_MARGIN
}

export function ballPosition(
  side: 'left' | 'right',
  ballY: number,
  size: number
): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  const maxY = workArea.y + workArea.height - size
  const y =
    ballY < 0 ? Math.round(workArea.y + workArea.height / 2 - size / 2) : clamp(Math.round(ballY), workArea.y, maxY)
  const x = side === 'right' ? workArea.x + workArea.width - size : workArea.x
  return { x, y }
}

export function getBallWindow(): BrowserWindow | null {
  return ballWindow
}

export function createBallWindow(rendererUrl: string | null): BrowserWindow {
  const settings = loadSettings()
  const size = ballWindowSize()
  const pos = ballPosition(settings.ballSide, settings.ballY, size)
  ballWindow = new BrowserWindow({
    width: size,
    height: size,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
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
  ballWindow.setAlwaysOnTop(true, 'screen-saver')
  ballWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (rendererUrl) {
    void ballWindow.loadURL(`${rendererUrl}/ball/index.html`)
  } else {
    void ballWindow.loadFile(path.join(__dirname, '../renderer/ball/index.html'))
  }
  ballWindow.once('ready-to-show', () => {
    applyBallAppearance()
    ballWindow?.show()
  })
  ballWindow.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error(`[ball] ${message}`)
  })
  ballWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`[ball] did-fail-load ${code} ${description}`)
  })
  ballWindow.on('closed', () => {
    ballWindow = null
  })
  return ballWindow
}

export function applyBallAppearance(): void {
  if (!ballWindow) return
  const size = ballWindowSize()
  const settings = loadSettings()
  ballWindow.setSize(size, size)
  const target = ballPosition(settings.ballSide, settings.ballY, size)
  ballWindow.setPosition(target.x, target.y)
  ballWindow.webContents.send('ball:appearance')
}

export function startBallDrag(): void {
  if (!ballWindow) return
  const startCursor = screen.getCursorScreenPoint()
  const [startX, startY] = ballWindow.getPosition()
  if (dragTimer) clearInterval(dragTimer)
  dragTimer = setInterval(() => {
    if (!ballWindow) return
    const cursor = screen.getCursorScreenPoint()
    const dx = cursor.x - startCursor.x
    const dy = cursor.y - startCursor.y
    const display = screen.getDisplayNearestPoint(cursor)
    const size = ballWindowSize()
    const x = clamp(startX + dx, display.workArea.x, display.workArea.x + display.workArea.width - size)
    const y = clamp(startY + dy, display.workArea.y, display.workArea.y + display.workArea.height - size)
    ballWindow.setPosition(Math.round(x), Math.round(y))
  }, 16)
}

function animateTo(targetX: number, targetY: number): void {
  if (!ballWindow) return
  const [fromX, fromY] = ballWindow.getPosition()
  const steps = 8
  let step = 0
  const timer = setInterval(() => {
    if (!ballWindow) {
      clearInterval(timer)
      return
    }
    step += 1
    const t = step / steps
    const ease = 1 - (1 - t) * (1 - t)
    ballWindow.setPosition(
      Math.round(fromX + (targetX - fromX) * ease),
      Math.round(fromY + (targetY - fromY) * ease)
    )
    if (step >= steps) clearInterval(timer)
  }, 16)
}

export function endBallDrag(): void {
  if (dragTimer) {
    clearInterval(dragTimer)
    dragTimer = null
  }
  if (!ballWindow) return
  const [x, y] = ballWindow.getPosition()
  const display = screen.getDisplayNearestPoint({ x, y })
  const size = ballWindowSize()
  const centerX = x + size / 2
  const distanceLeft = Math.abs(centerX - display.workArea.x)
  const distanceRight = Math.abs(display.workArea.x + display.workArea.width - centerX)
  const side: 'left' | 'right' = distanceLeft < distanceRight ? 'left' : 'right'
  const snapX = side === 'right' ? display.workArea.x + display.workArea.width - size : display.workArea.x
  const snapY = clamp(y, display.workArea.y, display.workArea.y + display.workArea.height - size)
  animateTo(snapX, snapY)
  saveSettings({ ballSide: side, ballY: snapY })
}

export function setBallStreaming(streaming: boolean): void {
  ballWindow?.webContents.send('app:streaming', streaming)
}

export function broadcastSettingsChanged(): void {
  ballWindow?.webContents.send('settings:changed')
}

export function sideOfBall(): 'left' | 'right' {
  return windowSide()
}
