import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { AgentMode, LocalToolsSettings } from '../../shared/types'
import type { OpenAIFunctionTool } from '../mcp/tools'

const MAX_READ_BYTES = 200_000
const MAX_OUTPUT_CHARS = 20_000
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000
const MAX_COMMAND_TIMEOUT_MS = 600_000
const MAX_LIST_ENTRIES = 300
const SEARCH_MAX_RESULTS = 80
const SEARCH_MAX_FILE_BYTES = 512_000
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'release',
  'target',
  '.cache',
  '.idea',
  '.vscode',
  '.next',
  'coverage'
])

const TOOL_NAMES = ['read_file', 'write_file', 'edit_file', 'list_dir', 'search_files', 'run_command'] as const
export type LocalToolName = (typeof TOOL_NAMES)[number]

export const READ_ONLY_LOCAL_TOOLS = ['read_file', 'list_dir', 'search_files'] as const

const SCHEMAS: Record<LocalToolName, { description: string; parameters: Record<string, unknown> }> = {
  read_file: {
    description: '读取本机文本文件内容（受设置的本地工具工作区限制，最多读取前 200KB）',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '文件绝对路径' } },
      required: ['path']
    }
  },
  write_file: {
    description: '写入或创建本机文件（覆盖写入，自动创建父目录）。调用前会请求用户确认。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件绝对路径' },
        content: { type: 'string', description: '完整文件内容' }
      },
      required: ['path', 'content']
    }
  },
  edit_file: {
    description:
      '对本机文件做精确字符串替换。old_string 必须在文件中唯一（否则需 replace_all=true）。调用前会请求用户确认。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件绝对路径' },
        old_string: { type: 'string', description: '要被替换的原文（建议包含足够上下文以保证唯一）' },
        new_string: { type: 'string', description: '替换后的内容' },
        replace_all: { type: 'boolean', description: '是否替换所有匹配项，默认 false' }
      },
      required: ['path', 'old_string', 'new_string']
    }
  },
  list_dir: {
    description: '列出本机目录内容（不传 path 时列出第一个工作区根目录）',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '目录绝对路径（可选）' } }
    }
  },
  search_files: {
    description:
      '在本机工作区内搜索文件名与文本内容，返回匹配行（默认跳过 node_modules/.git/dist 等目录，最多 80 条）',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词（不区分大小写）' },
        path: { type: 'string', description: '起始目录（可选，默认第一个工作区根目录）' },
        glob: { type: 'string', description: '文件名通配符过滤，如 *.ts（可选）' }
      },
      required: ['query']
    }
  },
  run_command: {
    description:
      '在本机执行 shell 命令并返回退出码与输出（默认 120 秒超时，最长 600 秒）。调用前会请求用户确认。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        cwd: { type: 'string', description: '工作目录（可选，必须在工作区内）' },
        timeout_ms: { type: 'number', description: '超时毫秒数（可选，默认 120000）' }
      },
      required: ['command']
    }
  }
}

export function isLocalTool(name: string): boolean {
  return (TOOL_NAMES as readonly string[]).includes(name)
}

export function localToolSchemas(
  settings: LocalToolsSettings | undefined,
  mode: AgentMode = 'build'
): OpenAIFunctionTool[] {
  if (!settings?.enabled) return []
  const planMode = mode === 'plan'
  return TOOL_NAMES.filter((name) => {
    if (planMode) return (READ_ONLY_LOCAL_TOOLS as readonly string[]).includes(name)
    return name !== 'run_command' || settings.allowCommands
  }).map((name) => ({
    type: 'function' as const,
    function: {
      name,
      description: SCHEMAS[name].description,
      parameters: SCHEMAS[name].parameters
    }
  }))
}

export async function executeLocalTool(
  name: string,
  args: Record<string, unknown>,
  settings: LocalToolsSettings,
  mode: AgentMode = 'build'
): Promise<string> {
  if (mode === 'plan' && !(READ_ONLY_LOCAL_TOOLS as readonly string[]).includes(name)) {
    throw new Error('当前处于 Plan（计划）模式：只允许读取与检索，请切换到 Build 模式后再执行写操作')
  }
  switch (name as LocalToolName) {
    case 'read_file':
      return readFile(args, settings)
    case 'write_file':
      return writeFile(args, settings)
    case 'edit_file':
      return editFile(args, settings)
    case 'list_dir':
      return listDir(args, settings)
    case 'search_files':
      return searchFiles(args, settings)
    case 'run_command':
      return runCommand(args, settings)
    default:
      throw new Error(`未知的本地工具：${name}`)
  }
}

function configuredRoots(settings: LocalToolsSettings): string[] {
  return (settings.roots ?? [])
    .map((root) => String(root).trim())
    .filter((root) => root.length > 0)
    .map((root) => path.resolve(root))
}

function resolveInside(input: string, settings: LocalToolsSettings, label: string): string {
  const roots = configuredRoots(settings)
  if (roots.length === 0) {
    throw new Error('尚未配置本地工具工作区：请到「设置 → 本地工具」添加允许访问的目录')
  }
  const value = typeof input === 'string' ? input.trim() : ''
  if (value.length === 0) {
    throw new Error(`${label} 不能为空`)
  }
  const target = path.resolve(value)
  const inside = roots.some((root) => target === root || target.startsWith(root + path.sep))
  if (!inside) {
    throw new Error(`路径超出允许范围：${target}（当前工作区：${roots.join('、')}）`)
  }
  return target
}

function truncate(text: string, limit = MAX_OUTPUT_CHARS): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n…（输出已截断，共 ${text.length} 字符）`
}

async function readFile(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  const target = resolveInside(String(args.path ?? ''), settings, 'path')
  const stat = await fs.promises.stat(target)
  if (stat.isDirectory()) {
    throw new Error(`目标是目录，请使用 list_dir：${target}`)
  }
  const length = Math.min(stat.size, MAX_READ_BYTES)
  const handle = await fs.promises.open(target, 'r')
  try {
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    const suffix =
      stat.size > MAX_READ_BYTES ? `\n…（文件较大，仅读取前 ${MAX_READ_BYTES} 字节，共 ${stat.size} 字节）` : ''
    return `文件：${target}（${stat.size} 字节）\n${buffer.toString('utf8')}${suffix}`
  } finally {
    await handle.close()
  }
}

async function writeFile(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  const target = resolveInside(String(args.path ?? ''), settings, 'path')
  const content = typeof args.content === 'string' ? args.content : ''
  await fs.promises.mkdir(path.dirname(target), { recursive: true })
  await fs.promises.writeFile(target, content, 'utf8')
  return `已写入：${target}（${Buffer.byteLength(content, 'utf8')} 字节）`
}

async function editFile(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  const target = resolveInside(String(args.path ?? ''), settings, 'path')
  const oldString = typeof args.old_string === 'string' ? args.old_string : ''
  const newString = typeof args.new_string === 'string' ? args.new_string : ''
  if (oldString.length === 0) {
    throw new Error('old_string 不能为空')
  }
  const content = await fs.promises.readFile(target, 'utf8')
  const count = content.split(oldString).length - 1
  if (count === 0) {
    throw new Error('未找到 old_string，文件未修改')
  }
  const replaceAll = args.replace_all === true
  if (count > 1 && !replaceAll) {
    throw new Error(`old_string 出现 ${count} 次，请提供更精确的上下文，或设置 replace_all=true`)
  }
  const next = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString)
  await fs.promises.writeFile(target, next, 'utf8')
  return `已修改：${target}（替换 ${replaceAll ? count : 1} 处）`
}

async function listDir(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  const roots = configuredRoots(settings)
  const target =
    typeof args.path === 'string' && args.path.trim().length > 0
      ? resolveInside(args.path, settings, 'path')
      : roots[0]
  if (!target) {
    throw new Error('尚未配置本地工具工作区：请到「设置 → 本地工具」添加允许访问的目录')
  }
  const entries = await fs.promises.readdir(target, { withFileTypes: true })
  const sorted = entries
    .map((entry) => ({
      name: entry.name,
      dir: entry.isDirectory()
    }))
    .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
  const lines = sorted.slice(0, MAX_LIST_ENTRIES).map((entry) => `${entry.dir ? '[目录]' : '[文件]'} ${entry.name}`)
  const suffix = sorted.length > MAX_LIST_ENTRIES ? `\n…（共 ${sorted.length} 项，仅显示前 ${MAX_LIST_ENTRIES} 项）` : ''
  return `目录：${target}（${sorted.length} 项）\n${lines.join('\n')}${suffix}`
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

async function searchFiles(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  const query = String(args.query ?? '').trim()
  if (query.length === 0) {
    throw new Error('query 不能为空')
  }
  const roots = configuredRoots(settings)
  const start =
    typeof args.path === 'string' && args.path.trim().length > 0
      ? resolveInside(args.path, settings, 'path')
      : roots[0]
  if (!start) {
    throw new Error('尚未配置本地工具工作区：请到「设置 → 本地工具」添加允许访问的目录')
  }
  const glob = typeof args.glob === 'string' && args.glob.trim().length > 0 ? args.glob.trim() : ''
  const matcher = glob ? globToRegExp(glob) : null
  const results: string[] = []
  const needle = query.toLowerCase()

  const walk = async (dir: string): Promise<void> => {
    if (results.length >= SEARCH_MAX_RESULTS) return
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= SEARCH_MAX_RESULTS) return
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full)
        continue
      }
      if (matcher && !matcher.test(entry.name)) continue
      if (entry.name.toLowerCase().includes(needle)) {
        results.push(`[文件名] ${full}`)
      }
      try {
        const stat = await fs.promises.stat(full)
        if (stat.size > SEARCH_MAX_FILE_BYTES) continue
        const content = await fs.promises.readFile(full, 'utf8')
        if (!content.toLowerCase().includes(needle)) continue
        const lines = content.split('\n')
        for (let index = 0; index < lines.length; index += 1) {
          if (results.length >= SEARCH_MAX_RESULTS) return
          if (lines[index].toLowerCase().includes(needle)) {
            const text = lines[index].trim().slice(0, 160)
            results.push(`${full}:${index + 1}: ${text}`)
          }
        }
      } catch {
        void 0
      }
    }
  }

  await walk(start)
  if (results.length === 0) {
    return `未找到匹配「${query}」的内容（搜索目录：${start}）`
  }
  const suffix = results.length >= SEARCH_MAX_RESULTS ? `\n…（最多显示 ${SEARCH_MAX_RESULTS} 条）` : ''
  return `匹配「${query}」（${results.length} 条）：\n${results.join('\n')}${suffix}`
}

function runCommand(args: Record<string, unknown>, settings: LocalToolsSettings): Promise<string> {
  if (!settings.allowCommands) {
    throw new Error('命令执行已在「设置 → 本地工具」中关闭')
  }
  const command = String(args.command ?? '').trim()
  if (command.length === 0) {
    throw new Error('command 不能为空')
  }
  const roots = configuredRoots(settings)
  const cwd =
    typeof args.cwd === 'string' && args.cwd.trim().length > 0 ? resolveInside(args.cwd, settings, 'cwd') : roots[0]
  if (!cwd) {
    throw new Error('尚未配置本地工具工作区：请到「设置 → 本地工具」添加允许访问的目录')
  }
  const timeoutRaw = Number(args.timeout_ms)
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0
    ? Math.min(Math.max(timeoutRaw, 1_000), MAX_COMMAND_TIMEOUT_MS)
    : DEFAULT_COMMAND_TIMEOUT_MS

  return new Promise((resolve) => {
    exec(
      command,
      { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const out = truncate(String(stdout ?? ''))
        const err = truncate(String(stderr ?? ''))
        const killed = Boolean(error && (error as { killed?: boolean }).killed)
        if (killed) {
          resolve(`命令超时（超过 ${timeoutMs}ms）：${command}\n--- stdout ---\n${out || '（空）'}\n--- stderr ---\n${err || '（空）'}`)
          return
        }
        const exitCode = error
          ? typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : 1
          : 0
        resolve(
          `命令：${command}\n工作目录：${cwd}\n退出码：${exitCode}\n--- stdout ---\n${out || '（空）'}\n--- stderr ---\n${err || '（空）'}`
        )
      }
    )
  })
}
