import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '', setPath: () => undefined }
}))

describe('auto launch registry helpers', () => {
  it('quotes the executable path', async () => {
    const { buildRunValue } = await import('../src/main/services/autoLaunch')
    expect(buildRunValue('D:\\Program Files\\DeepSeekBall\\DeepSeekBall.exe')).toBe(
      '"D:\\Program Files\\DeepSeekBall\\DeepSeekBall.exe"'
    )
  })

  it('detects an active run entry from reg query output', async () => {
    const { isRunEntryActive } = await import('../src/main/services/autoLaunch')
    const output = [
      '',
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      '    DeepSeekBall    REG_SZ    "D:\\Program Files\\DeepSeekBall\\DeepSeekBall.exe"',
      ''
    ].join('\r\n')
    expect(isRunEntryActive(output, 'D:\\Program Files\\DeepSeekBall\\DeepSeekBall.exe')).toBe(true)
    expect(isRunEntryActive(output, 'D:\\Other\\DeepSeekBall.exe')).toBe(false)
  })

  it('tolerates forward slashes and case differences', async () => {
    const { isRunEntryActive } = await import('../src/main/services/autoLaunch')
    const output = '    DeepSeekBall    REG_SZ    "d:/projects/deepseek-ball/release/win-unpacked/deepseekball.exe"'
    expect(
      isRunEntryActive(output, 'D:\\Projects\\deepseek-ball\\release\\win-unpacked\\DeepSeekBall.exe')
    ).toBe(true)
  })

  it('returns false when the entry is missing', async () => {
    const { isRunEntryActive } = await import('../src/main/services/autoLaunch')
    expect(isRunEntryActive('ERROR: The system was unable to find the specified registry key', 'D:\\a.exe')).toBe(
      false
    )
  })
})
