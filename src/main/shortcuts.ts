import { globalShortcut } from 'electron'
import { loadSettings } from './config'
import { showPanel, togglePanel } from './windows/panelWindow'
import { startCapture } from './windows/capture'
import { getRendererUrl } from './runtime'

let failed: string[] = []

function clipboardAsk(): void {
  void import('./windows/clipboardAsk').then((mod) => mod.clipboardAsk())
}

export function registerShortcuts(): string[] {
  globalShortcut.unregisterAll()
  failed = []
  if (process.env.DSBALL_DISABLE_HOTKEYS === '1') return failed
  const { hotkeys } = loadSettings()
  const entries: Array<[string, () => void]> = [
    [hotkeys.togglePanel, () => togglePanel()],
    [hotkeys.screenshot, () => void startCapture(getRendererUrl())],
    [hotkeys.clipboard, clipboardAsk]
  ]
  for (const [accelerator, handler] of entries) {
    if (!accelerator?.trim()) continue
    try {
      const ok = globalShortcut.register(accelerator, handler)
      if (!ok) failed.push(accelerator)
    } catch {
      failed.push(accelerator)
    }
  }
  if (failed.length > 0) console.error(`[hotkeys] 注册失败（可能被占用）：${failed.join(', ')}`)
  return failed
}

export function getFailedHotkeys(): string[] {
  return failed
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
}

export { showPanel }
