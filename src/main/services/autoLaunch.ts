import { execFile } from 'node:child_process'
import { app } from 'electron'

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const APPROVED_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
const VALUE_NAME = 'DeepSeekBall'
const ENABLED_BLOB = '020000000000000000000000'

export interface AutoLaunchResult {
  ok: boolean
  active: boolean
  message: string
}

export function autoLaunchSupported(): boolean {
  return app.isPackaged
}

export function buildRunValue(exePath: string): string {
  return `"${exePath}"`
}

export function isRunEntryActive(regQueryOutput: string, exePath: string): boolean {
  const expected = exePath.replace(/\//g, '\\').toLowerCase()
  for (const line of regQueryOutput.split(/\r?\n/)) {
    const match = /REG_SZ\s+(.*)$/.exec(line.trim())
    if (!match) continue
    const value = match[1].trim().replace(/^"|"$/g, '').replace(/\//g, '\\').toLowerCase()
    if (value === expected) return true
  }
  return false
}

function reg(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true }, (error, stdout, stderr) => {
      const code = error ? ((error as { code?: number }).code ?? 1) : 0
      resolve({ code, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

export async function getAutoLaunchState(): Promise<boolean> {
  if (!autoLaunchSupported()) return false
  const result = await reg(['query', RUN_KEY, '/v', VALUE_NAME])
  if (result.code !== 0) return false
  return isRunEntryActive(result.stdout, process.execPath)
}

async function enableAutoLaunch(): Promise<AutoLaunchResult> {
  const exePath = process.execPath
  const add = await reg([
    'add',
    RUN_KEY,
    '/v',
    VALUE_NAME,
    '/t',
    'REG_SZ',
    '/d',
    buildRunValue(exePath),
    '/f'
  ])
  if (add.code !== 0) {
    return {
      ok: false,
      active: false,
      message: `写入注册表失败：${add.stderr.trim() || `exit ${add.code}`}`
    }
  }
  await reg(['add', APPROVED_KEY, '/v', VALUE_NAME, '/t', 'REG_BINARY', '/d', ENABLED_BLOB, '/f'])
  const active = await getAutoLaunchState()
  return active
    ? { ok: true, active: true, message: '已开启开机自启' }
    : { ok: false, active: false, message: '注册表写入后校验失败，可能被安全软件拦截' }
}

async function disableAutoLaunch(): Promise<AutoLaunchResult> {
  const del = await reg(['delete', RUN_KEY, '/v', VALUE_NAME, '/f'])
  const stillThere = await getAutoLaunchState()
  if (stillThere) {
    return { ok: false, active: true, message: '删除注册表项失败' }
  }
  void del
  return { ok: true, active: false, message: '已关闭开机自启' }
}

export async function setAutoLaunch(enabled: boolean): Promise<AutoLaunchResult> {
  if (!autoLaunchSupported()) {
    return {
      ok: false,
      active: false,
      message: '开发模式（npm run dev）不支持开机自启，请使用安装后的应用'
    }
  }
  try {
    return enabled ? await enableAutoLaunch() : await disableAutoLaunch()
  } catch (error) {
    return {
      ok: false,
      active: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function syncAutoLaunch(): Promise<void> {
  if (!autoLaunchSupported()) return
  const { loadSettings } = await import('../config')
  const settings = loadSettings()
  if (settings.autoLaunch) await setAutoLaunch(true)
}
