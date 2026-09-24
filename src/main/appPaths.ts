import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const LEGACY_DATA_DIR = 'D:\\DeepSeekBall\\data'

function dirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function primaryDataDir(): string {
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), 'data')
  }
  const exeDir = path.dirname(app.getPath('exe'))
  const releaseMatch = exeDir.match(/^(.*)[\\/]release[\\/][^\\/]+$/i)
  if (releaseMatch) {
    return path.join(releaseMatch[1], 'data')
  }
  return path.join(exeDir, 'data')
}

function migrateFrom(sources: string[], target: string): void {
  if (fs.existsSync(path.join(target, 'config.json'))) return
  for (const source of sources) {
    if (!fs.existsSync(path.join(source, 'config.json'))) continue
    for (const item of ['config.json', 'secrets.json', 'conversations', 'attachments']) {
      const from = path.join(source, item)
      if (!fs.existsSync(from)) continue
      try {
        fs.cpSync(from, path.join(target, item), { recursive: true })
      } catch {
        void 0
      }
    }
    return
  }
}

export function configureUserData(): string {
  const candidates = [
    primaryDataDir(),
    LEGACY_DATA_DIR,
    path.join(app.getPath('appData'), 'DeepSeekBall')
  ]
  let dir = candidates[candidates.length - 1]
  for (const candidate of candidates) {
    if (dirWritable(candidate)) {
      dir = candidate
      break
    }
  }
  fs.mkdirSync(dir, { recursive: true })
  migrateFrom(
    candidates.filter((candidate) => candidate !== dir),
    dir
  )
  app.setPath('userData', dir)
  try {
    app.setPath('sessionData', path.join(dir, 'session'))
  } catch {
    void 0
  }
  return dir
}

export function dataDir(): string {
  return app.getPath('userData')
}

export function subDir(name: string): string {
  const dir = path.join(dataDir(), name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
