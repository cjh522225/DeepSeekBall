import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class {},
  app: { getPath: () => '', setPath: () => undefined }
}))

describe('deepseek web pow solver', () => {
  it('produces a deterministic sha256 chain', async () => {
    const { sha256Hex, solvePow } = await import('../src/main/providers/deepseekWeb')
    const challenge = 'abc123'
    const salt = 'salt456'
    let expected = sha256Hex(`${challenge}${salt}`)
    for (let i = 0; i < 3; i += 1) expected = sha256Hex(`${expected}${salt}`)
    expect(solvePow(challenge, salt, 3)).toBe(expected)
    expect(solvePow(challenge, salt, 3)).toHaveLength(64)
  })

  it('changes with difficulty', async () => {
    const { solvePow } = await import('../src/main/providers/deepseekWeb')
    expect(solvePow('c', 's', 0)).not.toBe(solvePow('c', 's', 1))
  })
})
