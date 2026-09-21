import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useChatStore } from '../stores/chatStore'
import { toFileUrl } from '../lib/format'
import { CameraIcon, CloseIcon, SendIcon, StopIcon } from './Icons'

const MAX_TEXTAREA_HEIGHT = 180

export function Composer(): JSX.Element {
  const draft = useChatStore((s) => s.draft)
  const setDraft = useChatStore((s) => s.setDraft)
  const quote = useChatStore((s) => s.quote)
  const setQuote = useChatStore((s) => s.setQuote)
  const attachments = useChatStore((s) => s.attachments)
  const addAttachment = useChatStore((s) => s.addAttachment)
  const removeAttachment = useChatStore((s) => s.removeAttachment)
  const clearAttachments = useChatStore((s) => s.clearAttachments)
  const requestId = useChatStore((s) => s.requestId)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const showToast = useChatStore((s) => s.showToast)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [draft])

  const submit = (): void => {
    if (requestId) return
    if (!draft.trim() && attachments.length === 0 && !quote.trim()) return
    void send(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const onPaste = async (event: ClipboardEvent<HTMLTextAreaElement>): Promise<void> => {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const bytes = new Uint8Array(await file.arrayBuffer())
      const attachment = await window.api.attach.saveBuffer(bytes, item.type)
      if (attachment) addAttachment(attachment)
      else showToast({ type: 'error', message: '图片保存失败' })
    }
  }

  const canSend = Boolean(draft.trim() || attachments.length || quote.trim())

  return (
    <div className="border-t border-ds-border bg-ds-panel px-3 pb-2.5 pt-2.5 dark:border-dsdark-border dark:bg-dsdark-panel">
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="group relative">
              <img
                src={toFileUrl(attachment.filePath)}
                alt="待发送图片"
                className="h-14 w-14 rounded-lg border border-ds-border object-cover dark:border-dsdark-border"
              />
              <button
                type="button"
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white group-hover:flex"
                onClick={() => removeAttachment(attachment.id)}
                title="移除"
              >
                <CloseIcon width={10} height={10} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="self-end rounded px-1.5 py-0.5 text-[11px] text-ds-sub hover:text-ds-text dark:text-dsdark-sub dark:hover:text-dsdark-text"
            onClick={clearAttachments}
          >
            清空图片
          </button>
        </div>
      ) : null}

      {quote ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-ds-brand/60 bg-ds-hover/60 px-2.5 py-1.5 dark:bg-dsdark-hover/60">
          <div className="max-h-20 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ds-sub dark:text-dsdark-sub">
            {quote}
          </div>
          <button
            type="button"
            className="mt-0.5 shrink-0 text-ds-sub hover:text-ds-text dark:text-dsdark-sub dark:hover:text-dsdark-text"
            onClick={() => setQuote('')}
            title="移除引用"
          >
            <CloseIcon width={12} height={12} />
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-ds-border bg-ds-bg transition-colors focus-within:border-ds-brand/60 dark:border-dsdark-border dark:bg-dsdark-bg dark:focus-within:border-dsdark-brand/60">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => void onPaste(e)}
          rows={1}
          placeholder="输入问题，Enter 发送，Shift+Enter 换行…"
          className="block max-h-[180px] w-full resize-none bg-transparent px-3.5 pt-2.5 text-[14px] leading-relaxed text-ds-text outline-none placeholder:text-ds-sub dark:text-dsdark-text dark:placeholder:text-dsdark-sub"
        />
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
              onClick={() => window.api.capture.start()}
              title="截图提问（Alt+Shift+A）"
            >
              <CameraIcon width={15} height={15} />
            </button>
          </div>
          {requestId ? (
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg bg-ds-hover px-2.5 py-1.5 text-xs text-ds-text transition-colors hover:bg-ds-border dark:bg-dsdark-hover dark:text-dsdark-text dark:hover:bg-dsdark-border"
              onClick={stop}
            >
              <StopIcon width={12} height={12} />
              停止生成
            </button>
          ) : (
            <button
              type="button"
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                canSend
                  ? 'bg-ds-brand text-white hover:bg-ds-brandDark'
                  : 'cursor-not-allowed bg-ds-hover text-ds-sub dark:bg-dsdark-hover dark:text-dsdark-sub'
              }`}
              onClick={submit}
              disabled={!canSend}
              title="发送（Enter）"
            >
              <SendIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 px-1 text-[11px] text-ds-sub dark:text-dsdark-sub">
        Enter 发送 · Shift+Enter 换行 · 支持粘贴图片
      </div>
    </div>
  )
}
