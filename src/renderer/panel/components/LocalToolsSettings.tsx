import { useState } from 'react'
import type { LocalToolsSettings as LocalToolsSettingsValue } from '../../../shared/types'
import { useSettingsStore } from '../stores/settingsStore'
import { AlertIcon, FolderIcon, PlusIcon, TrashIcon } from './Icons'

const inputClass =
  'w-full rounded-lg border border-ds-border bg-ds-bg px-2.5 py-1.5 text-xs text-ds-text outline-none transition-colors focus:border-ds-brand/60 dark:border-dsdark-border dark:bg-dsdark-bg dark:text-dsdark-text dark:focus:border-dsdark-brand/60'

const buttonClass =
  'rounded-lg border border-ds-border px-2.5 py-1 text-[11px] text-ds-sub transition-colors hover:border-ds-brand/50 hover:text-ds-text disabled:opacity-50 dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text'

function Toggle({
  title,
  hint,
  checked,
  onChange
}: {
  title: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-ds-border px-2.5 py-2 text-xs dark:border-dsdark-border">
      <span>
        {title}
        <span className="mt-0.5 block text-[11px] text-ds-sub dark:text-dsdark-sub">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-ds-brand"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

export function LocalToolsSettings(): JSX.Element {
  const settings = useSettingsStore((state) => state.settings)
  const patch = useSettingsStore((state) => state.patch)
  const [draft, setDraft] = useState('')

  const local: LocalToolsSettingsValue = settings?.localTools ?? {
    enabled: false,
    roots: [],
    allowCommands: true
  }

  const update = async (next: Partial<LocalToolsSettingsValue>): Promise<void> => {
    await patch({ localTools: { ...local, ...next } })
  }

  const addRoot = async (): Promise<void> => {
    const value = draft.trim()
    if (!value) return
    if (!local.roots.includes(value)) {
      await update({ roots: [...local.roots, value] })
    }
    setDraft('')
  }

  const pickRoot = async (): Promise<void> => {
    const dir = await window.api.app.pickDirectory()
    if (!dir || local.roots.includes(dir)) return
    await update({ roots: [...local.roots, dir] })
  }

  const removeRoot = async (index: number): Promise<void> => {
    await update({ roots: local.roots.filter((_, current) => current !== index) })
  }

  return (
    <div className="space-y-2.5">
      <Toggle
        title="启用本地工具（读写文件 / 执行命令）"
        hint="模型可读写工作区内文件，并执行 shell 命令；写文件与执行命令前都会弹窗确认"
        checked={local.enabled}
        onChange={(value) => void update({ enabled: value })}
      />

      <div className="rounded-lg border border-ds-border p-2.5 dark:border-dsdark-border">
        <div className="mb-1.5 text-xs text-ds-text dark:text-dsdark-text">工作区目录（允许读写与执行的范围）</div>
        {local.roots.length === 0 ? (
          <div className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-500">
            <span className="mt-0.5">
              <AlertIcon width={12} height={12} />
            </span>
            未配置目录时本地工具不会执行，请至少添加一个目录（如 D:\Projects）
          </div>
        ) : (
          <ul className="mb-2 space-y-1">
            {local.roots.map((root, index) => (
              <li
                key={root}
                className="flex items-center gap-1.5 rounded-md bg-ds-hover px-2 py-1 text-[11px] dark:bg-dsdark-hover"
              >
                <FolderIcon width={12} height={12} />
                <span className="flex-1 truncate" title={root}>
                  {root}
                </span>
                <button
                  type="button"
                  className="text-ds-sub transition-colors hover:text-red-500 dark:text-dsdark-sub"
                  title="移除"
                  onClick={() => void removeRoot(index)}
                >
                  <TrashIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5">
          <input
            className={inputClass}
            placeholder="输入目录绝对路径，如 D:\\Projects"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addRoot()
            }}
          />
          <button type="button" className={buttonClass} onClick={() => void addRoot()} disabled={!draft.trim()}>
            <PlusIcon width={12} height={12} />
          </button>
          <button type="button" className={buttonClass} onClick={() => void pickRoot()}>
            浏览…
          </button>
        </div>
      </div>

      <Toggle
        title="允许执行 shell 命令（run_command）"
        hint="关闭后模型只能读写文件，不能执行命令；执行命令始终需要确认"
        checked={local.allowCommands}
        onChange={(value) => void update({ allowCommands: value })}
      />
    </div>
  )
}
