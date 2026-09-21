import { clipboard } from 'electron'
import { showPanel, sendToPanel } from './panelWindow'

export function clipboardAsk(): void {
  const text = clipboard.readText().trim()
  showPanel()
  if (text) {
    sendToPanel('composer:insert', { text, mode: 'quote' })
  } else {
    sendToPanel('toast', { type: 'warn', message: '剪贴板没有文本内容' })
  }
}
