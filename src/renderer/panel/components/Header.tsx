import type { AgentMode } from '../../../shared/types'
import { GearIcon, ListIcon, PlusIcon } from './Icons'

interface Props {
  title: string
  view: 'chat' | 'settings'
  mode: AgentMode
  onModeChange: (mode: AgentMode) => void
  onToggleDrawer: () => void
  onNewChat: () => void
  onOpenSettings: () => void
  onCollapse: () => void
}

export function Header({
  title,
  view,
  mode,
  onModeChange,
  onToggleDrawer,
  onNewChat,
  onOpenSettings,
  onCollapse
}: Props): JSX.Element {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-ds-border px-2 dark:border-dsdark-border">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
        onClick={onToggleDrawer}
        title="会话列表"
      >
        <ListIcon width={16} height={16} />
      </button>
      <div className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-ds-text dark:text-dsdark-text">
        {view === 'settings' ? '设置' : title}
      </div>
      {view === 'chat' ? (
        <>
          <div
            className="flex h-7 shrink-0 items-center rounded-lg border border-ds-border p-0.5 text-[11px] dark:border-dsdark-border"
            title="Plan：只读分析并给出计划；Build：可写文件与执行命令"
          >
            <button
              type="button"
              className={`rounded-md px-2 py-0.5 transition-colors ${
                mode === 'plan'
                  ? 'bg-amber-500/15 font-medium text-amber-600 dark:text-amber-400'
                  : 'text-ds-sub hover:text-ds-text dark:text-dsdark-sub dark:hover:text-dsdark-text'
              }`}
              onClick={() => onModeChange('plan')}
            >
              计划
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-0.5 transition-colors ${
                mode === 'build'
                  ? 'bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-ds-sub hover:text-ds-text dark:text-dsdark-sub dark:hover:text-dsdark-text'
              }`}
              onClick={() => onModeChange('build')}
            >
              构建
            </button>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
            onClick={onNewChat}
            title="新建会话"
          >
            <PlusIcon width={16} height={16} />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
            onClick={onOpenSettings}
            title="设置"
          >
            <GearIcon width={15} height={15} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
          onClick={onOpenSettings}
          title="返回对话"
        >
          <svg
            viewBox="0 0 24 24"
            width={15}
            height={15}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          返回
        </button>
      )}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
        onClick={onCollapse}
        title="收起面板"
      >
        <svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
    </div>
  )
}
