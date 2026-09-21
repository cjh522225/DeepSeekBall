import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../stores/chatStore'
import { ChevronDownIcon, SparkleIcon } from './Icons'
import { MessageItem } from './MessageItem'

const SUGGESTIONS = [
  '用通俗的语言解释一下量子纠缠',
  '写一个 Python 快速排序并加注释',
  '帮我把这段话润色得更正式一些',
  '总结一下深度学习和机器学习的区别'
]

export function MessageList(): JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const setDraft = useChatStore((s) => s.setDraft)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const onScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickRef.current = distance < 80
    setShowJump(!stickRef.current)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (stickRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const jumpToBottom = (): void => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    stickRef.current = true
    setShowJump(false)
  }

  const lastAssistantIndex = [...messages].reduce(
    (acc, m, i) => (m.role === 'assistant' ? i : acc),
    -1
  )

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-hidden scroll-smooth"
        onScroll={onScroll}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6d8bff] to-[#3850e0] text-white shadow-lg shadow-blue-500/25">
              <SparkleIcon width={26} height={26} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ds-text dark:text-dsdark-text">
                有什么可以帮你？
              </div>
              <div className="mt-1 text-xs text-ds-sub dark:text-dsdark-sub">
                支持 Markdown、公式与代码 · 可截图或粘贴图片提问
              </div>
            </div>
            <div className="flex w-full max-w-[320px] flex-col gap-1.5">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-xl border border-ds-border bg-ds-panel px-3 py-2 text-left text-xs text-ds-text transition-colors hover:border-ds-brand/50 hover:bg-ds-hover dark:border-dsdark-border dark:bg-dsdark-panel dark:text-dsdark-text dark:hover:bg-dsdark-hover"
                  onClick={() => setDraft(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pb-4 pt-2">
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isLast={index === lastAssistantIndex}
              />
            ))}
          </div>
        )}
      </div>
      {showJump ? (
        <button
          type="button"
          className="absolute bottom-3 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-ds-border bg-ds-panel text-ds-sub shadow-md transition-colors hover:text-ds-text dark:border-dsdark-border dark:bg-dsdark-panel dark:text-dsdark-sub dark:hover:text-dsdark-text"
          onClick={jumpToBottom}
          title="回到底部"
        >
          <ChevronDownIcon width={15} height={15} />
        </button>
      ) : null}
    </div>
  )
}
