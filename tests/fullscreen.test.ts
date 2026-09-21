import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '', setPath: () => undefined, isPackaged: false }
}))

describe('fullscreen watcher probe parsing', () => {
  it('parses probe output lines', async () => {
    const { parseProbeLine } = await import('../src/main/services/fullscreenWatcher')
    expect(parseProbeLine('F')).toBe(true)
    expect(parseProbeLine('N')).toBe(false)
    expect(parseProbeLine(' F \r')).toBe(true)
    expect(parseProbeLine('')).toBeNull()
    expect(parseProbeLine('garbage')).toBeNull()
  })
})
