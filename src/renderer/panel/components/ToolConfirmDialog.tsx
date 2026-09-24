import { useChatStore } from '../stores/chatStore'
import { AlertIcon, ToolIcon } from './Icons'

export function ToolConfirmDialog(): JSX.Element | null {
  const confirm = useChatStore((s) => s.toolConfirm)
  const respond = useChatStore((s) => s.respondToolConfirm)
  if (!confirm) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 px-4">
      <div className="w-full rounded-2xl border border-ds-border bg-ds-panel p-3.5 shadow-xl dark:border-dsdark-border dark:bg-dsdark-panel">
        <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ds-text dark:text-dsdark-text">
          <AlertIcon width={14} height={14} className="text-amber-500" />
          需要确认后执行
        </div>
        <div className="mb-2 text-[11px] leading-relaxed text-ds-sub dark:text-dsdark-sub">
          模型请求执行可能修改数据的工具，是否允许？
        </div>
        <div className="mb-3 rounded-lg border border-ds-border bg-ds-bg px-2.5 py-2 dark:border-dsdark-border dark:bg-dsdark-bg">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-ds-text dark:text-dsdark-text">
            <ToolIcon width={13} height={13} className="text-ds-brand dark:text-dsdark-brand" />
            {confirm.toolCall.name}
          </div>
          <div className="mt-0.5 text-[10px] text-ds-sub dark:text-dsdark-sub">
            {confirm.toolCall.serverName}
          </div>
          <div className="mt-1.5 max-h-32 overflow-y-auto break-all font-mono text-[10px] leading-relaxed text-ds-sub dark:text-dsdark-sub">
            {confirm.toolCall.args}
          </div>
        </div>
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            className="rounded-lg border border-ds-border px-3 py-1.5 text-xs transition-colors hover:bg-ds-hover dark:border-dsdark-border dark:hover:bg-dsdark-hover"
            onClick={() => respond(false)}
          >
            拒绝
          </button>
          <button
            type="button"
            className="rounded-lg bg-ds-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ds-brandDark"
            onClick={() => respond(true)}
          >
            允许执行
          </button>
        </div>
      </div>
    </div>
  )
}
