import { useChatStore } from '../stores/chatStore'
import { AlertIcon, CheckIcon } from './Icons'

export function Toast(): JSX.Element | null {
  const toast = useChatStore((s) => s.toast)
  const dismiss = useChatStore((s) => s.dismissToast)
  if (!toast) return null
  const isError = toast.type !== 'info'
  return (
    <button
      type="button"
      className={`absolute bottom-24 left-1/2 z-40 flex max-w-[85%] -translate-x-1/2 items-start gap-1.5 rounded-xl border px-3 py-2 text-left text-xs shadow-lg animate-fade-in ${
        isError
          ? 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/60 dark:text-red-300'
          : 'border-ds-border bg-ds-panel text-ds-text dark:border-dsdark-border dark:bg-dsdark-panel dark:text-dsdark-text'
      }`}
      onClick={dismiss}
      title="点击关闭"
    >
      {isError ? (
        <AlertIcon width={13} height={13} className="mt-0.5 shrink-0" />
      ) : (
        <CheckIcon width={13} height={13} className="mt-0.5 shrink-0" />
      )}
      <span className="leading-relaxed">{toast.message}</span>
    </button>
  )
}
