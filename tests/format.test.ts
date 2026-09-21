import { describe, expect, it } from 'vitest'
import { formatRelativeTime, toFileUrl, truncate } from '../src/renderer/panel/lib/format'

describe('format helpers', () => {
  it('builds dsfile urls for windows paths', () => {
    expect(toFileUrl('D:\\DeepSeekBall\\data\\attachments\\a.png')).toBe(
      'dsfile:///D:/DeepSeekBall/data/attachments/a.png'
    )
    expect(toFileUrl('D:\\a b\\c#1.png')).toBe('dsfile:///D:/a%20b/c%231.png')
  })

  it('truncates long text on whitespace boundaries', () => {
    expect(truncate('hello   world', 20)).toBe('hello world')
    expect(truncate('a'.repeat(30), 10)).toBe('aaaaaaaaaa…')
  })

  it('formats relative times', () => {
    expect(formatRelativeTime(Date.now())).toBe('刚刚')
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5 分钟前')
    expect(formatRelativeTime(Date.now() - 3 * 24 * 3600_000)).toBe('3 天前')
  })
})
