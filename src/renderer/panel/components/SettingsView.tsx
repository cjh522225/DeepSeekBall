import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ProviderKind } from '../../../shared/types'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'
import { AlertIcon, CheckIcon, FolderIcon } from './Icons'
import { McpSettings } from './McpSettings'
import { LocalToolsSettings } from './LocalToolsSettings'

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ds-sub dark:text-dsdark-sub">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: string
}): JSX.Element {
  return (
    <div>
      <div className="mb-1 text-xs text-ds-text dark:text-dsdark-text">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-[11px] text-ds-sub dark:text-dsdark-sub">{hint}</div> : null}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-ds-border bg-ds-bg px-2.5 py-1.5 text-xs text-ds-text outline-none transition-colors focus:border-ds-brand/60 dark:border-dsdark-border dark:bg-dsdark-bg dark:text-dsdark-text dark:focus:border-dsdark-brand/60'

interface Preset {
  key: string
  label: string
  provider: ProviderKind
  baseUrl: string
  model: string
}

const PRESETS: Preset[] = [
  {
    key: 'deepseek',
    label: 'DeepSeek 官方',
    provider: 'official',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat'
  },
  {
    key: 'opencode-go',
    label: 'OpenCode Go',
    provider: 'custom',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    model: 'deepseek-v4-flash'
  },
  {
    key: 'ollama',
    label: '本地 Ollama',
    provider: 'custom',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen3:8b'
  }
]

const OPENCODE_GO_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'minimax-m3',
  'kimi-k3',
  'kimi-k2.7-code',
  'glm-5.2',
  'glm-5.3',
  'qwen3.7-max',
  'qwen3.7-plus',
  'mimo-v2.5-pro',
  'longcat-2.0'
]

function HotkeyInput({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const [recording, setRecording] = useState(false)
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.preventDefault()
    if (event.key === 'Escape') {
      setRecording(false)
      event.currentTarget.blur()
      return
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
    const parts: string[] = []
    if (event.ctrlKey) parts.push('Ctrl')
    if (event.altKey) parts.push('Alt')
    if (event.shiftKey) parts.push('Shift')
    if (event.metaKey) parts.push('Super')
    const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
    parts.push(key)
    onChange(parts.join('+'))
    setRecording(false)
    event.currentTarget.blur()
  }
  return (
    <input
      readOnly
      value={recording ? '请按下组合键…' : value}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={onKeyDown}
      className={`${inputClass} cursor-pointer text-center font-mono`}
    />
  )
}

export function SettingsView(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const patch = useSettingsStore((s) => s.patch)
  const refresh = useSettingsStore((s) => s.refresh)
  const showToast = useChatStore((s) => s.showToast)

  const [provider, setProvider] = useState<ProviderKind>('official')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [temperature, setTemperature] = useState(1)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [maxContextMessages, setMaxContextMessages] = useState(30)
  const [hotkeys, setHotkeys] = useState({ togglePanel: '', screenshot: '', clipboard: '' })
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [dataDirPath, setDataDirPath] = useState('')

  useEffect(() => {
    window.api.app
      .getDataDir()
      .then((dir) => setDataDirPath(dir))
      .catch(() => void 0)
  }, [])

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!settings || initializedRef.current) return
    initializedRef.current = true
    setProvider(settings.provider)
    setBaseUrl(settings.baseUrl)
    setModel(settings.model)
    setTemperature(settings.temperature)
    setSystemPrompt(settings.systemPrompt)
    setMaxContextMessages(settings.maxContextMessages)
    setHotkeys(settings.hotkeys)
  }, [settings])

  if (!settings) {
    return <div className="flex-1 p-4 text-xs text-ds-sub">加载设置中…</div>
  }

  const saveConnection = async (): Promise<void> => {
    const next = await patch({
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      temperature,
      systemPrompt,
      maxContextMessages,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
    })
    setApiKey('')
    setStatus({ ok: true, message: `已保存${next.apiKeySet ? '（API Key 已加密存储）' : ''}` })
  }

  const saveHotkeys = async (): Promise<void> => {
    const next = await patch({ hotkeys })
    if (next.failedHotkeys.length > 0) {
      setStatus({
        ok: false,
        message: `以下快捷键被占用，注册失败：${next.failedHotkeys.join('、')}`
      })
    } else {
      setStatus({ ok: true, message: '快捷键已生效' })
    }
  }

  const runTest = async (): Promise<void> => {
    setTesting(true)
    setStatus(null)
    try {
      const result = await window.api.settings.test()
      setStatus(result)
    } finally {
      setTesting(false)
    }
  }

  const fetchModels = async (): Promise<void> => {
    const result = await window.api.settings.listModels()
    if (result.ok) {
      setModels(result.models)
      showToast({ type: 'info', message: `已获取 ${result.models.length} 个模型` })
    } else {
      setStatus({ ok: false, message: result.message ?? '获取模型失败' })
    }
  }

  const pickTheme = (theme: 'system' | 'light' | 'dark'): void => {
    void patch({ theme })
  }

  const applyPreset = (preset: Preset): void => {
    setProvider(preset.provider)
    setBaseUrl(preset.baseUrl)
    setModel(preset.model)
    setStatus({ ok: true, message: `已填入「${preset.label}」参数，请填写 API Key 后点击保存` })
  }

  const importOpenCodeKey = async (): Promise<void> => {
    const result = await window.api.settings.importOpenCodeKey()
    setStatus(result)
    await refresh()
  }

  const toggleAutoLaunch = async (enabled: boolean): Promise<void> => {
    const next = await patch({ autoLaunch: enabled })
    if (!next.autoLaunchSupported) {
      showToast({ type: 'warn', message: '开发模式不支持开机自启，安装后使用即可生效' })
      return
    }
    if (next.autoLaunch !== next.autoLaunchActive) {
      showToast({
        type: 'error',
        message: '开机自启设置未生效，可能被系统或安全软件拦截（可在任务管理器→启动应用中检查）'
      })
      return
    }
    showToast({ type: 'info', message: enabled ? '已开启开机自启' : '已关闭开机自启' })
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
      <Section title="模型连接">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['official', '官方 API'],
              ['custom', '兼容接口'],
              ['web', '网页模式']
            ] as Array<[ProviderKind, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                provider === value
                  ? 'border-ds-brand bg-ds-brand/10 text-ds-brand dark:border-dsdark-brand dark:text-dsdark-brand'
                  : 'border-ds-border text-ds-sub hover:text-ds-text dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text'
              }`}
              onClick={() => setProvider(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {provider !== 'web' ? (
          <Field label="快速配置" hint="一键填入常用服务地址与模型（API Key 需单独填写或导入）">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className="rounded-lg border border-ds-border px-2 py-1 text-[11px] text-ds-sub transition-colors hover:border-ds-brand/50 hover:text-ds-text dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        {provider === 'web' ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="mb-1.5 flex items-center gap-1 font-medium">
              <AlertIcon width={12} height={12} />
              实验性功能
            </div>
            复用你的 DeepSeek 网页登录态调用其内部接口，可能违反服务条款、随时失效。建议仅个人测试使用。需要已登录的账号：
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-lg bg-ds-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-ds-brandDark"
                onClick={() => void window.api.settings.webLogin()}
              >
                登录网页账号
              </button>
              <button
                type="button"
                className="rounded-lg border border-ds-border px-2.5 py-1 text-[11px] hover:bg-ds-hover dark:border-dsdark-border dark:hover:bg-dsdark-hover"
                onClick={() => void window.api.settings.webLogout().then(() => refresh())}
              >
                退出登录
              </button>
              <span className="ml-1 text-[11px]">
                状态：{settings.webLoggedIn ? '已登录' : '未登录'}
              </span>
            </div>
          </div>
        ) : (
          <>
            <Field label="Base URL">
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className={inputClass}
                placeholder="https://api.deepseek.com"
              />
            </Field>
            <Field
              label="API Key"
              hint={settings.apiKeySet ? '已保存密钥（加密存储），留空则不修改' : '尚未设置 API Key'}
            >
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClass}
                placeholder={settings.apiKeySet ? '••••••••（已设置）' : 'sk-…'}
              />
              <button
                type="button"
                className="mt-1.5 rounded-lg border border-ds-border px-2.5 py-1 text-[11px] text-ds-sub transition-colors hover:border-ds-brand/50 hover:text-ds-text dark:border-dsdark-border dark:text-dsdark-sub dark:hover:text-dsdark-text"
                onClick={() => void importOpenCodeKey()}
              >
                从本机 OpenCode 导入密钥
              </button>
            </Field>
          </>
        )}

        <Field label="模型">
          <div className="flex gap-1.5">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="model-list"
              className={inputClass}
              placeholder="deepseek-chat / deepseek-reasoner"
            />
            {provider !== 'web' ? (
              <button
                type="button"
                className="shrink-0 rounded-lg border border-ds-border px-2.5 text-[11px] hover:bg-ds-hover dark:border-dsdark-border dark:hover:bg-dsdark-hover"
                onClick={() => void fetchModels()}
              >
                拉取
              </button>
            ) : null}
          </div>
          <datalist id="model-list">
            {[...new Set([...models, ...(baseUrl.includes('opencode.ai') ? OPENCODE_GO_MODELS : [])])].map(
              (item) => (
                <option key={item} value={item} />
              )
            )}
          </datalist>
        </Field>

        <Field label={`温度：${temperature.toFixed(1)}`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-[#4d6bfe]"
          />
        </Field>

        <Field label="系统提示词（可选）">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="例如：你是一个简洁高效的中文助手…"
          />
        </Field>

        <Field label={`上下文携带消息数：${maxContextMessages}`}>
          <input
            type="range"
            min={4}
            max={80}
            step={2}
            value={maxContextMessages}
            onChange={(e) => setMaxContextMessages(Number(e.target.value))}
            className="w-full accent-[#4d6bfe]"
          />
        </Field>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-ds-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ds-brandDark"
            onClick={() => void saveConnection()}
          >
            保存连接设置
          </button>
          <button
            type="button"
            className="rounded-lg border border-ds-border px-3 py-1.5 text-xs transition-colors hover:bg-ds-hover disabled:opacity-50 dark:border-dsdark-border dark:hover:bg-dsdark-hover"
            onClick={() => void runTest()}
            disabled={testing}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
        </div>
        {status ? (
          <div
            className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
              status.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
            }`}
          >
            {status.ok ? <CheckIcon width={12} height={12} /> : <AlertIcon width={12} height={12} />}
            <span className="break-all">{status.message}</span>
          </div>
        ) : null}
      </Section>

      <Section title="MCP 服务器">
        <McpSettings />
      </Section>

      <Section title="Agent 模式">
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`flex-1 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
              settings.agentMode === 'plan'
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-ds-border text-ds-sub hover:border-ds-brand/40 dark:border-dsdark-border dark:text-dsdark-sub'
            }`}
            onClick={() => void patch({ agentMode: 'plan' })}
          >
            计划（只读）
            <span className="mt-0.5 block text-[11px] text-ds-sub dark:text-dsdark-sub">
              只能读取/检索与查询数据，先给方案，不改文件不执行命令
            </span>
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
              settings.agentMode === 'build'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-ds-border text-ds-sub hover:border-ds-brand/40 dark:border-dsdark-border dark:text-dsdark-sub'
            }`}
            onClick={() => void patch({ agentMode: 'build' })}
          >
            构建（可写）
            <span className="mt-0.5 block text-[11px] text-ds-sub dark:text-dsdark-sub">
              开放文件读写与命令执行，破坏性操作每次弹窗确认
            </span>
          </button>
        </div>
      </Section>

      <Section title="本地工具">
        <LocalToolsSettings />
      </Section>

      <Section title="图片提问">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              settings.imageHandling === 'ocr'
                ? 'border-ds-brand bg-ds-brand/10 text-ds-brand dark:border-dsdark-brand dark:text-dsdark-brand'
                : 'border-ds-border text-ds-sub dark:border-dsdark-border dark:text-dsdark-sub'
            }`}
            onClick={() => void patch({ imageHandling: 'ocr' })}
          >
            OCR 识别为文字
          </button>
          <button
            type="button"
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              settings.imageHandling === 'vision'
                ? 'border-ds-brand bg-ds-brand/10 text-ds-brand dark:border-dsdark-brand dark:text-dsdark-brand'
                : 'border-ds-border text-ds-sub dark:border-dsdark-border dark:text-dsdark-sub'
            }`}
            onClick={() => void patch({ imageHandling: 'vision' })}
          >
            发送图片给多模态模型
          </button>
        </div>
        <div className="text-[11px] leading-relaxed text-ds-sub dark:text-dsdark-sub">
          截图/粘贴图片后：OCR 模式使用 Windows 自带识别（适合 deepseek-chat 等纯文本模型）；多模态模式需要
          Base URL 与模型支持图片输入（如 Qwen-VL、GPT-4o 等）。
        </div>
      </Section>

      <Section title="外观">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['system', '跟随系统'],
              ['light', '浅色'],
              ['dark', '深色']
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-lg border px-2 py-1.5 text-xs ${
                settings.theme === value
                  ? 'border-ds-brand bg-ds-brand/10 text-ds-brand dark:border-dsdark-brand dark:text-dsdark-brand'
                  : 'border-ds-border text-ds-sub dark:border-dsdark-border dark:text-dsdark-sub'
              }`}
              onClick={() => pickTheme(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label={`悬浮球大小：${settings.ballSize}px`}>
          <input
            type="range"
            min={44}
            max={96}
            step={2}
            value={settings.ballSize}
            onChange={(e) => void patch({ ballSize: Number(e.target.value) })}
            className="w-full accent-[#4d6bfe]"
          />
        </Field>
        <Field label={`悬浮球不透明度：${Math.round(settings.ballOpacity * 100)}%`}>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={settings.ballOpacity}
            onChange={(e) => void patch({ ballOpacity: Number(e.target.value) })}
            className="w-full accent-[#4d6bfe]"
          />
        </Field>
        <label className="flex cursor-pointer items-center justify-between text-xs text-ds-text dark:text-dsdark-text">
          <span>显示思考过程（推理模型）</span>
          <input
            type="checkbox"
            checked={settings.showReasoning}
            onChange={(e) => void patch({ showReasoning: e.target.checked })}
            className="h-3.5 w-3.5 accent-[#4d6bfe]"
          />
        </label>
      </Section>

      <Section title="快捷键">
        <Field label="打开 / 收起面板">
          <HotkeyInput
            value={hotkeys.togglePanel}
            onChange={(v) => setHotkeys((h) => ({ ...h, togglePanel: v }))}
          />
        </Field>
        <Field label="截图提问">
          <HotkeyInput
            value={hotkeys.screenshot}
            onChange={(v) => setHotkeys((h) => ({ ...h, screenshot: v }))}
          />
        </Field>
        <Field label="剪贴板提问">
          <HotkeyInput
            value={hotkeys.clipboard}
            onChange={(v) => setHotkeys((h) => ({ ...h, clipboard: v }))}
          />
        </Field>
        <button
          type="button"
          className="rounded-lg bg-ds-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ds-brandDark"
          onClick={() => void saveHotkeys()}
        >
          保存快捷键
        </button>
        {settings.failedHotkeys.length > 0 ? (
          <div className="text-[11px] text-amber-600 dark:text-amber-400">
            当前被占用未生效：{settings.failedHotkeys.join('、')}
          </div>
        ) : null}
      </Section>

      <Section title="系统与数据">
        <label className="flex cursor-pointer items-center justify-between text-xs text-ds-text dark:text-dsdark-text">
          <span>游戏 / 全屏应用时隐藏悬浮球</span>
          <input
            type="checkbox"
            checked={settings.hideOnFullscreen}
            onChange={(e) => void patch({ hideOnFullscreen: e.target.checked })}
            className="h-3.5 w-3.5 accent-[#4d6bfe]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between text-xs text-ds-text dark:text-dsdark-text">
          <span>开机自动启动</span>
          <input
            type="checkbox"
            checked={settings.autoLaunch}
            onChange={(e) => void toggleAutoLaunch(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#4d6bfe]"
          />
        </label>
        <div className="text-[11px] text-ds-sub dark:text-dsdark-sub">
          {settings.autoLaunchSupported
            ? settings.autoLaunchActive
              ? `已写入系统启动项：${settings.autoLaunch ? '下次登录自动运行' : '（设置已开启但未生效）'}`
              : settings.autoLaunch
                ? '设置已开启但系统启动项未生效，可能被安全软件拦截'
                : '当前未设置开机自启'
            : '开发模式（npm run dev）不支持开机自启，使用安装后的应用即可生效'}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-ds-border px-2.5 py-1.5 text-[11px] transition-colors hover:bg-ds-hover dark:border-dsdark-border dark:hover:bg-dsdark-hover"
            onClick={() => window.api.app.openDataDir()}
          >
            <FolderIcon width={12} height={12} />
            打开数据目录
          </button>
          <button
            type="button"
            className="rounded-lg border border-ds-border px-2.5 py-1.5 text-[11px] transition-colors hover:bg-ds-hover dark:border-dsdark-border dark:hover:bg-dsdark-hover"
            onClick={() => void window.api.conv.exportAll()}
          >
            导出全部数据
          </button>
        </div>
      </Section>

      <div className="border-t border-ds-border pt-3 text-center text-[11px] text-ds-sub dark:border-dsdark-border dark:text-dsdark-sub">
        DeepSeek Ball v{settings.version} · 数据存储于 {dataDirPath || '…'}
      </div>
    </div>
  )
}
