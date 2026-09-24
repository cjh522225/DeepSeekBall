import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  executeLocalTool,
  isLocalTool,
  localToolSchemas
} from '../src/main/local/localTools'
import { filterToolsForMode, isWriteTool, type OpenAIFunctionTool } from '../src/main/mcp/tools'
import type { LocalToolsSettings } from '../src/shared/types'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-local-'))
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dsb-outside-'))

const enabled: LocalToolsSettings = { enabled: true, roots: [root], allowCommands: true }

beforeAll(() => {
  fs.writeFileSync(path.join(root, 'notes.md'), '第一行\n关键词在这里\n第三行', 'utf8')
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
  fs.writeFileSync(path.join(root, 'node_modules', 'hidden.txt'), '关键词不该被搜到', 'utf8')
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(outside, { recursive: true, force: true })
})

describe('local tool schemas', () => {
  it('is empty when disabled and complete when enabled', () => {
    expect(localToolSchemas({ enabled: false, roots: [], allowCommands: true })).toEqual([])
    const names = localToolSchemas(enabled).map((tool) => tool.function.name)
    expect(names).toEqual(['read_file', 'write_file', 'edit_file', 'list_dir', 'search_files', 'run_command'])
  })

  it('hides run_command when commands are disabled', () => {
    const names = localToolSchemas({ ...enabled, allowCommands: false }).map((tool) => tool.function.name)
    expect(names).not.toContain('run_command')
  })

  it('treats mutating local tools as write tools', () => {
    for (const name of ['write_file', 'edit_file', 'run_command']) {
      expect(isLocalTool(name)).toBe(true)
      expect(isWriteTool(name)).toBe(true)
    }
    expect(isWriteTool('read_file')).toBe(false)
    expect(isWriteTool('list_dir')).toBe(false)
  })
})

describe('workspace containment', () => {
  it('refuses paths outside the configured roots', async () => {
    await expect(executeLocalTool('read_file', { path: path.join(outside, 'secret.txt') }, enabled)).rejects.toThrow(
      /超出允许范围/
    )
  })

  it('refuses everything when no root is configured', async () => {
    await expect(
      executeLocalTool('read_file', { path: path.join(root, 'notes.md') }, { enabled: true, roots: [], allowCommands: true })
    ).rejects.toThrow(/尚未配置本地工具工作区/)
  })
})

describe('file operations', () => {
  it('writes then reads a file', async () => {
    const target = path.join(root, 'sub', 'hello.txt')
    const writeResult = await executeLocalTool('write_file', { path: target, content: '你好，本机' }, enabled)
    expect(writeResult).toContain('已写入')
    const readResult = await executeLocalTool('read_file', { path: target }, enabled)
    expect(readResult).toContain('你好，本机')
  })

  it('edits a unique match and rejects ambiguous matches', async () => {
    const target = path.join(root, 'edit.txt')
    fs.writeFileSync(target, 'alpha\nbeta\nalpha\n', 'utf8')
    await expect(executeLocalTool('edit_file', { path: target, old_string: 'alpha', new_string: 'x' }, enabled)).rejects.toThrow(
      /出现 2 次/
    )
    await executeLocalTool('edit_file', { path: target, old_string: 'alpha', new_string: 'x', replace_all: true }, enabled)
    expect(fs.readFileSync(target, 'utf8')).toBe('x\nbeta\nx\n')
    await expect(
      executeLocalTool('edit_file', { path: target, old_string: 'missing', new_string: 'y' }, enabled)
    ).rejects.toThrow(/未找到 old_string/)
  })

  it('lists directories with folders first', async () => {
    const result = await executeLocalTool('list_dir', { path: root }, enabled)
    expect(result).toContain('[目录] node_modules')
    expect(result).toContain('[文件] notes.md')
  })

  it('searches file names and content but skips node_modules', async () => {
    const result = await executeLocalTool('search_files', { query: '关键词', path: root }, enabled)
    expect(result).toContain('notes.md')
    expect(result).not.toContain('hidden.txt')
  })
})

describe('plan mode', () => {
  it('exposes only read-only local tools', () => {
    const names = localToolSchemas(enabled, 'plan').map((tool) => tool.function.name)
    expect(names).toEqual(['read_file', 'list_dir', 'search_files'])
  })

  it('blocks write tools at execution time', async () => {
    await expect(
      executeLocalTool('write_file', { path: path.join(root, 'blocked.txt'), content: 'x' }, enabled, 'plan')
    ).rejects.toThrow(/Plan（计划）模式/)
    await expect(executeLocalTool('run_command', { command: 'echo hi' }, enabled, 'plan')).rejects.toThrow(
      /Plan（计划）模式/
    )
    expect(fs.existsSync(path.join(root, 'blocked.txt'))).toBe(false)
  })

  it('still allows reads in plan mode', async () => {
    const result = await executeLocalTool('read_file', { path: path.join(root, 'notes.md') }, enabled, 'plan')
    expect(result).toContain('关键词在这里')
  })
})

describe('tool filtering by mode', () => {
  const tools: OpenAIFunctionTool[] = [
    { type: 'function', function: { name: 'read_file', parameters: {} } },
    { type: 'function', function: { name: 'write_file', parameters: {} } },
    { type: 'function', function: { name: 'run_command', parameters: {} } },
    { type: 'function', function: { name: 'mySchedule', parameters: {} } },
    { type: 'function', function: { name: 'approveLeave', parameters: {} } },
    { type: 'function', function: { name: 'searchPolicy', parameters: {} } }
  ]

  it('keeps all tools in build mode', () => {
    expect(filterToolsForMode(tools, 'build')).toHaveLength(6)
  })

  it('keeps only read-only tools in plan mode', () => {
    const names = filterToolsForMode(tools, 'plan').map((tool) => tool.function.name)
    expect(names).toEqual(['read_file', 'mySchedule', 'searchPolicy'])
  })
})

describe('command execution', () => {
  it('runs a command and reports exit code and output', async () => {
    const result = await executeLocalTool('run_command', { command: 'echo hello-local' }, enabled)
    expect(result).toContain('退出码：0')
    expect(result).toContain('hello-local')
  })

  it('reports non-zero exit codes without throwing', async () => {
    const result = await executeLocalTool('run_command', { command: 'exit 7' }, enabled)
    expect(result).toContain('退出码：7')
  })

  it('is blocked when commands are disabled', async () => {
    await expect(
      executeLocalTool('run_command', { command: 'echo nope' }, { ...enabled, allowCommands: false })
    ).rejects.toThrow(/命令执行已在/)
  })
})
