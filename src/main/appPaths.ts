import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const PREFERRED_DATA_DIR = 'D:\\DeepSeekBall\\data'

export function configureUserData(): string {
  let dir = PREFERRED_DATA_DIR
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
  } catch {
    dir = path.join(app.getPath('appData'), 'DeepSeekBall')
    fs.mkdirSync(dir, { recursive: true })
  }
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
