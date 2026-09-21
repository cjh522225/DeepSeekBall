import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { subDir } from '../appPaths'
import type { Attachment } from '../../shared/types'

const ALLOWED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/gif': '.gif'
}

export function saveImageBuffer(bytes: Uint8Array, mime: string): Attachment {
  const ext = ALLOWED[mime] ?? '.png'
  const dir = subDir('attachments')
  const filePath = path.join(dir, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return { id: randomUUID(), type: 'image', filePath }
}

export function saveImageBase64(base64: string): Attachment {
  const bytes = Buffer.from(base64, 'base64')
  return saveImageBuffer(bytes, 'image/png')
}

export function isInsideDataDir(filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath)
    const allowed = [path.resolve(subDir('attachments')), path.resolve(subDir('screenshots'))]
    return allowed.some((dir) => resolved.startsWith(dir))
  } catch {
    return false
  }
}
