import { memo, useState } from 'react'
import type { ChatMessage } from '../../../shared/types'
import { toFileUrl } from '../lib/format'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  RefreshIcon,
  SparkleIcon
} from './Icons'
import { Markdown } from './Markdown'
import { ToolCallCard } from './ToolCallCard'

interface Props {
  message: ChatMessage
  isLast: boolean
}

export const MessageItem = memo(function MessageItem({ message, isLast }: Props): JSX.Element {
  const regenerate = useChatStore((s) => s.regenerate)
  const requestId = useChatStore((s) => s.requestId)
  const showReasoning = useSettingsStore((s) => s.settings?.showReasoning ?? true)
  const [copied, setCopied] = useState(false)
  const [reasoningOpen, setReasoningOpen] = useState(false)

  const isUser = message.role === 'user'
  const streaming = message.status === 'streaming'
  const busy = Boolean(requestId)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      void 0
    }
  }

  return (
    <div className={`group flex gap-2.5 px-3.5 py-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-ds-hover text-xs font-medium text-ds-sub dark:bg-dsdark-hover dark:text-dsdark-sub'
            : 'bg-gradient-to-br from-[#6d8bff] to-[#3850e0] text-white'
        }`}
      >
        {isUser ? '我' : <SparkleIcon width={14} height={14} />}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && showReasoning && message.reasoning ? (
          <div className="mb-1.5 w-full">
            <button
              type="button"
              className="flex items-center gap-1 rounded-full border border-ds-border bg-ds-panel px-2 py-0.5 text-[11px] text-ds-sub transition-colors hover:text-ds-text dark:border-dsdark-border dark:bg-dsdark-panel dark:text-dsdark-sub dark:hover:text-dsdark-text"
              onClick={() => setReasoningOpen((v) => !v)}
            >
              <ChevronDownIcon
                width={12}
                height={12}
                className={`transition-transform ${reasoningOpen ? 'rotate-180' : ''}`}
              />
              思考过程
            </button>
            {reasoningOpen ? (
              <div className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-dashed border-ds-border bg-ds-bg px-3 py-2 text-xs leading-relaxed text-ds-sub dark:border-dsdark-border dark:bg-dsdark-bg dark:text-dsdark-sub">
                {message.reasoning}
              </div>
            ) : null}
          </div>
        ) : null}

        {message.attachments?.length ? (
          <div className={`mb-1.5 flex flex-wrap gap-1.5 ${isUser ? 'justify-end' : ''}`}>
            {message.attachments.map((attachment) => (
              <img
                key={attachment.id}
                src={toFileUrl(attachment.filePath)}
                alt="附件"
                className="h-24 w-auto max-w-[220px] rounded-lg border border-ds-border object-cover dark:border-dsdark-border"
              />
            ))}
          </div>
        ) : null}

        {isUser ? (
          <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#e6ecfd] px-3.5 py-2 text-[14px] leading-relaxed text-ds-text dark:bg-[#2b3350] dark:text-dsdark-text">
            {message.content}
          </div>
        ) : (
          <div
            className={`w-full rounded-2xl rounded-tl-sm px-3.5 py-2 ${
              message.status === 'error'
                ? 'border border-red-300/60 bg-red-50/60 dark:border-red-500/30 dark:bg-red-950/20'
                : 'bg-white dark:bg-dsdark-panel'
            }`}
          >
            {message.toolCalls?.length ? (
              <div className="mb-1.5 flex flex-col gap-1.5">
                {message.toolCalls.map((record) => (
                  <ToolCallCard key={record.id} record={record} />
                ))}
              </div>
            ) : null}
            {message.content ? (
              <Markdown content={message.content} />
            ) : streaming ? (
              <div className="flex items-center gap-2 py-1 text-xs text-ds-sub dark:text-dsdark-sub">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ds-border border-t-ds-brand dark:border-dsdark-border dark:border-t-dsdark-brand" />
                正在思考…
              </div>
            ) : null}
            {streaming && message.content ? (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-ds-brand align-text-bottom dark:bg-dsdark-brand" />
            ) : null}
            {message.status === 'error' ? (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
                <span className="break-all">{message.error ?? '生成失败'}</span>
              </div>
            ) : null}
          </div>
        )}

        {!isUser && !streaming && message.content ? (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ds-sub hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
              onClick={copy}
            >
              {copied ? <CheckIcon width={12} height={12} /> : <CopyIcon width={12} height={12} />}
              {copied ? '已复制' : '复制'}
            </button>
            {isLast && !busy ? (
              <button
                type="button"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ds-sub hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
                onClick={() => void regenerate()}
              >
                <RefreshIcon width={12} height={12} />
                重新生成
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
})
