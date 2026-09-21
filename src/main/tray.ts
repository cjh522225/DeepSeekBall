import path from 'node:path'
import { app, Menu, nativeImage, shell, Tray } from 'electron'
import { dataDir } from './appPaths'
import { loadSettings, saveSettings } from './config'
import { isPanelVisible, sendToPanel, showPanel, togglePanel } from './windows/panelWindow'
import { startCapture } from './windows/capture'
import { getRendererUrl } from './runtime'
import { syncFullscreenWatcher } from './services/fullscreenWatcher'
import { setAutoLaunch } from './services/autoLaunch'

let tray: Tray | null = null

function trayIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  const image = nativeImage.createFromPath(iconPath)
  return image.resize({ width: 16, height: 16 })
}

function buildMenu(): Menu {
  const settings = loadSettings()
  return Menu.buildFromTemplate([
    {
      label: isPanelVisible() ? '收起面板' : '打开面板',
      click: () => togglePanel()
    },
    {
      label: '新建会话',
      click: () => {
        showPanel()
        sendToPanel('menu', { action: 'new-conversation' })
      }
    },
    {
      label: '截图提问',
      click: () => void startCapture(getRendererUrl())
    },
    {
      label: '设置',
      click: () => {
        showPanel()
        sendToPanel('menu', { action: 'settings' })
      }
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (item) => {
        saveSettings({ autoLaunch: item.checked })
        void setAutoLaunch(item.checked).then((result) => {
          if (!result.ok) {
            console.error(`[autoLaunch] ${result.message}`)
          }
          refreshTrayMenu()
        })
      }
    },
    {
      label: '游戏/全屏时隐藏悬浮球',
      type: 'checkbox',
      checked: settings.hideOnFullscreen,
      click: (item) => {
        saveSettings({ hideOnFullscreen: item.checked })
        syncFullscreenWatcher()
        refreshTrayMenu()
      }
    },
    {
      label: '打开数据目录',
      click: () => void shell.openPath(dataDir())
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])
}

export function createTray(): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('DeepSeek Ball - 悬浮球 AI 助手')
  tray.setContextMenu(buildMenu())
  tray.on('click', () => togglePanel())
  tray.on('right-click', () => tray?.setContextMenu(buildMenu()))
}

export function refreshTrayMenu(): void {
  tray?.setContextMenu(buildMenu())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
