import { useState } from 'react'
import type { McpServerConfig, McpTransportKind } from '../../../shared/types'
import { useChatStore } from '../stores/chatStore'
import { useMcpStore } from '../stores/mcpStore'
import { AlertIcon, CheckIcon, ChevronDownIcon, PlugIcon, PlusIcon, TrashIcon } from './Icons'

const inputClass =
  'w-full rounded-lg border border-ds-border bg-ds-bg px-2.5 py-1.5 text-xs text-ds-text outline-none transition-colors focus:border-ds-brand/60 dark:border-dsdark-border dark:bg-dsdark-bg dark:text-dsdark-text dark:focus:border-dsdark-brand/60'

const buttonClass =
  'rounded-lg border border-ds-border px-2.5 py-1 text-[11px] text-ds-sub transition-colors hover:border-ds-brand/50 hover:text-ds-text disabled:opacity-50 dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text'

function emptyServer(): McpServerConfig {
  return { id: '', name: '', enabled: true, transport: 'sse', url: 'http://localhost:8090' }
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim()
  }
  return env
}

function envText(env?: Record<string, string>): string {
  return Object.entries(env ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

function stateLabel(state: string): string {
  if (state === 'connected') return '已连接'
  if (state === 'connecting') return '连接中'
  if (state === 'error') return '连接失败'
  return '未连接'
}

function stateClass(state: string): string {
  if (state === 'connected') return 'bg-emerald-500'
  if (state === 'connecting') return 'bg-amber-400'
  if (state === 'error') return 'bg-red-500'
  return 'bg-ds-border dark:bg-dsdark-border'
}

export function McpSettings(): JSX.Element {
  const servers = useMcpStore((s) => s.servers)
  const statuses = useMcpStore((s) => s.statuses)
  const upsert = useMcpStore((s) => s.upsert)
  const remove = useMcpStore((s) => s.remove)
  const refresh = useMcpStore((s) => s.refresh)
  const showToast = useChatStore((s) => s.showToast)

  const [draft, setDraft] = useState<McpServerConfig | null>(null)
  const [envDraft, setEnvDraft] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toolsOpen, setToolsOpen] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const startCreate = (): void => {
    setDraft(emptyServer())
    setEnvDraft('')
    setStatus(null)
  }

  const startEdit = (server: McpServerConfig): void => {
    setDraft({ ...server })
    setEnvDraft(envText(server.env))
    setStatus(null)
  }

  const patchDraft = (patch: Partial<McpServerConfig>): void => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const saveDraft = async (): Promise<void> => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setStatus({ ok: false, message: '请填写服务器名称' })
      return
    }
    const config: McpServerConfig = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      name,
      url: draft.transport === 'sse' ? draft.url?.trim() : undefined,
      command: draft.transport === 'stdio' ? draft.command?.trim() : undefined,
      args:
        draft.transport === 'stdio'
          ? (draft.args ?? []).map((arg) => arg.trim()).filter(Boolean)
          : undefined,
      env: draft.transport === 'stdio' ? parseEnv(envDraft) : undefined
    }
    if (config.transport === 'sse' && !config.url) {
      setStatus({ ok: false, message: '请填写 SSE 地址' })
      return
    }
    if (config.transport === 'stdio' && !config.command) {
      setStatus({ ok: false, message: '请填写 stdio 启动命令' })
      return
    }
    setBusy(true)
    try {
      await upsert(config)
      setDraft(null)
      showToast({ type: 'info', message: `已保存 MCP 服务器「${name}」` })
    } finally {
      setBusy(false)
    }
  }

  const testDraft = async (): Promise<void> => {
    if (!draft) return
    setBusy(true)
    setStatus(null)
    try {
      const result = await window.api.mcp.testConnection({
        ...draft,
        id: draft.id || 'draft',
        name: draft.name.trim() || 'MCP 服务器',
        url: draft.transport === 'sse' ? draft.url?.trim() : undefined,
        command: draft.transport === 'stdio' ? draft.command?.trim() : undefined,
        env: draft.transport === 'stdio' ? parseEnv(envDraft) : undefined
      })
      setStatus({ ok: result.ok, message: result.message })
    } finally {
      setBusy(false)
    }
  }

  const toggleEnabled = async (server: McpServerConfig, enabled: boolean): Promise<void> => {
    await upsert({ ...server, enabled })
  }

  const doRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await refresh()
      showToast({ type: 'info', message: '已刷新 MCP 连接状态' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[11px] leading-relaxed text-ds-sub dark:text-dsdark-sub">
        连接 MCP（Model Context Protocol）服务器，模型即可调用其工具。SSE 地址默认补全
        /sse 端点；写操作会先弹窗请求确认。当前已配置 {servers.length} 个服务器。
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-ds-brand px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-ds-brandDark"
          onClick={startCreate}
        >
          <PlusIcon width={12} height={12} />
          新增服务器
        </button>
        <button type="button" className={buttonClass} onClick={() => void doRefresh()} disabled={refreshing}>
          {refreshing ? '刷新中…' : '刷新连接'}
        </button>
      </div>

      {servers.map((server) => {
        const state = statuses[server.id]
        return (
          <div
            key={server.id}
            className="rounded-xl border border-ds-border bg-ds-panel px-2.5 py-2 dark:border-dsdark-border dark:bg-dsdark-panel"
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${stateClass(state?.state ?? 'disconnected')}`} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-ds-text dark:text-dsdark-text">
                {server.name}
              </span>
              <span className="shrink-0 rounded bg-ds-hover px-1.5 py-0.5 text-[10px] uppercase text-ds-sub dark:bg-dsdark-hover dark:text-dsdark-sub">
                {server.transport}
              </span>
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-ds-sub dark:text-dsdark-sub">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => void toggleEnabled(server, e.target.checked)}
                  className="h-3 w-3 accent-[#4d6bfe]"
                />
                启用
              </label>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-ds-sub dark:text-dsdark-sub">
              <span>{stateLabel(state?.state ?? 'disconnected')}</span>
              <span className="truncate">
                {server.transport === 'sse' ? server.url : [server.command, ...(server.args ?? [])].join(' ')}
              </span>
              {state?.error ? (
                <span className="flex min-w-0 items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertIcon width={11} height={11} className="shrink-0" />
                  <span className="truncate">{state.error}</span>
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 rounded border border-ds-border px-1.5 py-0.5 text-[10px] text-ds-sub hover:text-ds-text disabled:opacity-50 dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text"
                onClick={() => setToolsOpen(toolsOpen === server.id ? null : server.id)}
              >
                <PlugIcon width={11} height={11} />
                工具 {(state?.tools ?? []).length}
                <ChevronDownIcon
                  width={10}
                  height={10}
                  className={toolsOpen === server.id ? 'rotate-180' : ''}
                />
              </button>
              <button type="button" className={buttonClass} onClick={() => startEdit(server)}>
                编辑
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-ds-border px-2 py-1 text-[11px] text-ds-sub transition-colors hover:border-red-400/60 hover:text-red-600 dark:border-dsdark-border dark:text-dsdark-sub"
                onClick={() => void remove(server.id)}
              >
                <TrashIcon width={11} height={11} />
                删除
              </button>
            </div>
            {toolsOpen === server.id ? (
              <div className="mt-1.5 space-y-1 rounded-lg border border-dashed border-ds-border bg-ds-bg px-2 py-1.5 dark:border-dsdark-border dark:bg-dsdark-bg">
                {(state?.tools ?? []).length === 0 ? (
                  <div className="text-[10px] text-ds-sub dark:text-dsdark-sub">
                    暂无工具（服务器未连接或无工具）
                  </div>
                ) : (
                  state?.tools.map((tool) => (
                    <div key={tool.name} className="text-[10px] leading-relaxed">
                      <span className="font-mono text-ds-text dark:text-dsdark-text">{tool.name}</span>
                      <span className="ml-1 text-ds-sub dark:text-dsdark-sub">
                        {tool.description ?? ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )
      })}

      {draft ? (
        <div className="space-y-2 rounded-xl border border-ds-brand/40 bg-ds-panel px-2.5 py-2 dark:border-dsdark-brand/40 dark:bg-dsdark-panel">
          <div className="text-[11px] font-semibold text-ds-text dark:text-dsdark-text">
            {draft.id ? '编辑服务器' : '新增服务器'}
          </div>
          <input
            value={draft.name}
            onChange={(e) => patchDraft({ name: e.target.value })}
            className={inputClass}
            placeholder="名称，例如：本地 Agent 服务"
          />
          <div className="grid grid-cols-2 gap-1.5">
            {(['sse', 'stdio'] as McpTransportKind[]).map((transport) => (
              <button
                key={transport}
                type="button"
                className={`rounded-lg border px-2 py-1 text-[11px] ${
                  draft.transport === transport
                    ? 'border-ds-brand bg-ds-brand/10 text-ds-brand dark:border-dsdark-brand dark:text-dsdark-brand'
                    : 'border-ds-border text-ds-sub dark:border-dsdark-border dark:text-dsdark-sub'
                }`}
                onClick={() => patchDraft({ transport })}
              >
                {transport === 'sse' ? 'SSE (HTTP)' : 'stdio (本地进程)'}
              </button>
            ))}
          </div>
          {draft.transport === 'sse' ? (
            <input
              value={draft.url ?? ''}
              onChange={(e) => patchDraft({ url: e.target.value })}
              className={inputClass}
              placeholder="http://localhost:8090（自动补全 /sse）"
            />
          ) : (
            <>
              <input
                value={draft.command ?? ''}
                onChange={(e) => patchDraft({ command: e.target.value })}
                className={inputClass}
                placeholder="启动命令，例如 npx"
              />
              <input
                value={(draft.args ?? []).join(' ')}
                onChange={(e) => patchDraft({ args: e.target.value.split(' ') })}
                className={inputClass}
                placeholder="参数（空格分隔），例如 -y @modelcontextprotocol/server-filesystem D:\\data"
              />
              <textarea
                value={envDraft}
                onChange={(e) => setEnvDraft(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none font-mono`}
                placeholder={'环境变量，每行 KEY=VALUE（可选）'}
              />
            </>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ds-sub dark:text-dsdark-sub">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => patchDraft({ enabled: e.target.checked })}
              className="h-3 w-3 accent-[#4d6bfe]"
            />
            保存后立即启用并连接
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="rounded-lg bg-ds-brand px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-ds-brandDark disabled:opacity-50"
              onClick={() => void saveDraft()}
              disabled={busy}
            >
              保存
            </button>
            <button type="button" className={buttonClass} onClick={() => void testDraft()} disabled={busy}>
              {busy ? '测试中…' : '测试连接'}
            </button>
            <button type="button" className={buttonClass} onClick={() => setDraft(null)}>
              取消
            </button>
          </div>
          {status ? (
            <div
              className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] ${
                status.ok
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {status.ok ? <CheckIcon width={12} height={12} /> : <AlertIcon width={12} height={12} />}
              <span className="break-all">{status.message}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
