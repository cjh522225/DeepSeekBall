import { useState } from 'react'
import type { ToolCallRecord, ToolCallStatus } from '../../../shared/types'
import { AlertIcon, CheckIcon, ChevronDownIcon, CloseIcon, RefreshIcon, ToolIcon } from './Icons'

const STATUS_LABEL: Record<ToolCallStatus, string> = {
  running: '运行中',
  awaiting: '待确认',
  success: '成功',
  error: '失败',
  rejected: '已拒绝'
}

function statusClass(status: ToolCallStatus): string {
  if (status === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'error') return 'text-red-600 dark:text-red-400'
  if (status === 'rejected') return 'text-amber-600 dark:text-amber-400'
  return 'text-ds-sub dark:text-dsdark-sub'
}

function StatusIcon({ status }: { status: ToolCallStatus }): JSX.Element {
  if (status === 'success') return <CheckIcon width={12} height={12} />
  if (status === 'error') return <AlertIcon width={12} height={12} />
  if (status === 'rejected') return <CloseIcon width={12} height={12} />
  return (
    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
  )
}

export function ToolCallCard({ record }: { record: ToolCallRecord }): JSX.Element {
  const [open, setOpen] = useState(false)
  const detail = record.error ?? record.result
  const running = record.status === 'running' || record.status === 'awaiting'
  return (
    <div className="w-full rounded-xl border border-ds-border bg-ds-bg/60 px-2.5 py-1.5 dark:border-dsdark-border dark:bg-dsdark-bg/60">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <ToolIcon width={13} height={13} className="shrink-0 text-ds-brand dark:text-dsdark-brand" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ds-text dark:text-dsdark-text">
          {record.name}
        </span>
        <span className="shrink-0 text-[10px] text-ds-sub dark:text-dsdark-sub">
          {record.serverName}
        </span>
        <span
          className={`flex shrink-0 items-center gap-1 text-[10px] ${statusClass(record.status)}`}
        >
          <StatusIcon status={record.status} />
          {STATUS_LABEL[record.status]}
        </span>
        <ChevronDownIcon
          width={12}
          height={12}
          className={`shrink-0 text-ds-sub transition-transform dark:text-dsdark-sub ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div className="mt-1 truncate font-mono text-[10px] text-ds-sub dark:text-dsdark-sub">
        {record.args}
      </div>
      {open && (detail || running) ? (
        <div className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-dashed border-ds-border bg-ds-panel px-2 py-1.5 text-[11px] leading-relaxed text-ds-text dark:border-dsdark-border dark:bg-dsdark-panel dark:text-dsdark-text">
          {detail ? (
            detail
          ) : (
            <span className="flex items-center gap-1.5 text-ds-sub dark:text-dsdark-sub">
              <RefreshIcon width={12} height={12} />
              等待工具返回…
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}
