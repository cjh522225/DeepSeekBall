import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'

function scriptPath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'ocr.ps1')
  return path.join(app.getAppPath(), 'resources', 'ocr.ps1')
}

function normalize(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function runOcr(
  imagePath: string
): Promise<{ ok: boolean; text: string; message?: string }> {
  const outPath = path.join(os.tmpdir(), `dsball-ocr-${Date.now()}.txt`)
  const script = scriptPath()
  if (!fs.existsSync(script)) {
    return { ok: false, text: '', message: '未找到 OCR 脚本 resources/ocr.ps1' }
  }
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-ImagePath',
        imagePath,
        '-OutPath',
        outPath
      ],
      { windowsHide: true }
    )
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      resolve({ ok: false, text: '', message: error.message })
    })
    child.on('close', (code) => {
      let text = ''
      try {
        if (fs.existsSync(outPath)) text = normalize(fs.readFileSync(outPath, 'utf8'))
      } catch {
        void 0
      }
      try {
        fs.rmSync(outPath, { force: true })
      } catch {
        void 0
      }
      if (code === 0 && text) resolve({ ok: true, text })
      else if (code === 0) resolve({ ok: false, text: '', message: 'OCR 未识别到文字' })
      else resolve({ ok: false, text: '', message: stderr.trim().slice(0, 300) || `OCR 失败（exit ${code}）` })
    })
  })
}
