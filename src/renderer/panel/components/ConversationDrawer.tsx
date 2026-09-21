import { useState } from 'react'
import { useConvStore } from '../stores/convStore'
import { formatRelativeTime, truncate } from '../lib/format'
import { DownloadIcon, FolderIcon, PlusIcon, SearchIcon, TrashIcon } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
}

export function ConversationDrawer({ open, onClose }: Props): JSX.Element {
  const list = useConvStore((s) => s.list)
  const results = useConvStore((s) => s.results)
  const query = useConvStore((s) => s.query)
  const currentId = useConvStore((s) => s.currentId)
  const select = useConvStore((s) => s.select)
  const create = useConvStore((s) => s.create)
  const remove = useConvStore((s) => s.remove)
  const rename = useConvStore((s) => s.rename)
  const search = useConvStore((s) => s.search)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const data = results ?? list

  const handleSelect = (id: string): void => {
    void select(id)
    onClose()
  }

  const handleNew = (): void => {
    void create().then(() => onClose())
  }

  const commitRename = (id: string): void => {
    void rename(id, editingTitle)
    setEditingId(null)
  }

  const handleExportAll = (): void => {
    void window.api.conv.exportAll()
  }

  return (
    <>
      {open ? (
        <div
          className="absolute inset-0 z-20 bg-black/25 animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`absolute inset-y-0 left-0 z-30 flex w-[270px] flex-col border-r border-ds-border bg-ds-panel shadow-xl transition-transform duration-200 dark:border-dsdark-border dark:bg-dsdark-panel ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <span className="text-xs font-medium text-ds-sub dark:text-dsdark-sub">会话记录</span>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
            onClick={handleNew}
            title="新建会话"
          >
            <PlusIcon width={14} height={14} />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 dark:border-dsdark-border dark:bg-dsdark-bg">
            <SearchIcon width={13} height={13} className="shrink-0 text-ds-sub" />
            <input
              value={query}
              onChange={(e) => void search(e.target.value)}
              placeholder="搜索会话内容"
              className="w-full bg-transparent text-xs text-ds-text outline-none placeholder:text-ds-sub dark:text-dsdark-text dark:placeholder:text-dsdark-sub"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {data.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-ds-sub dark:text-dsdark-sub">
              {query ? '没有匹配的会话' : '还没有会话，点击 + 开始'}
            </div>
          ) : (
            data.map((meta) => (
              <div
                key={meta.id}
                className={`group relative mb-0.5 cursor-pointer rounded-lg px-2.5 py-2 transition-colors ${
                  meta.id === currentId
                    ? 'bg-ds-hover dark:bg-dsdark-hover'
                    : 'hover:bg-ds-hover/70 dark:hover:bg-dsdark-hover/70'
                }`}
                onClick={() => handleSelect(meta.id)}
              >
                {editingId === meta.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => commitRename(meta.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(meta.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-ds-brand/50 bg-transparent px-1 py-0.5 text-xs text-ds-text outline-none dark:text-dsdark-text"
                  />
                ) : (
                  <div
                    className="truncate pr-12 text-[13px] text-ds-text dark:text-dsdark-text"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingId(meta.id)
                      setEditingTitle(meta.title)
                    }}
                    title={`${meta.title}（双击重命名）`}
                  >
                    {truncate(meta.title, 22)}
                  </div>
                )}
                <div className="mt-0.5 text-[11px] text-ds-sub dark:text-dsdark-sub">
                  {formatRelativeTime(meta.updatedAt)} · {meta.messageCount} 条
                </div>
                <button
                  type="button"
                  className={`absolute right-2 top-2 flex h-6 items-center justify-center rounded px-1.5 text-[10px] transition-colors ${
                    pendingDelete === meta.id
                      ? 'bg-red-500/90 text-white'
                      : 'hidden text-ds-sub hover:bg-black/5 hover:text-red-500 group-hover:flex dark:text-dsdark-sub dark:hover:bg-white/10'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (pendingDelete === meta.id) {
                      setPendingDelete(null)
                      void remove(meta.id)
                    } else {
                      setPendingDelete(meta.id)
                      setTimeout(() => setPendingDelete((v) => (v === meta.id ? null : v)), 2500)
                    }
                  }}
                  title={pendingDelete === meta.id ? '再次点击确认删除' : '删除会话'}
                >
                  {pendingDelete === meta.id ? '确认删除' : <TrashIcon width={12} height={12} />}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-ds-border px-2 py-2 dark:border-dsdark-border">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
            onClick={handleExportAll}
          >
            <DownloadIcon width={13} height={13} />
            导出全部
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-ds-sub transition-colors hover:bg-ds-hover hover:text-ds-text dark:text-dsdark-sub dark:hover:bg-dsdark-hover dark:hover:text-dsdark-text"
            onClick={() => window.api.app.openDataDir()}
          >
            <FolderIcon width={13} height={13} />
            数据目录
          </button>
        </div>
      </aside>
    </>
  )
}
