const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const MAX_ATTEMPTS = 30
const RETRY_DELAY_MS = 2000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findRcedit() {
  const local = path.join(__dirname, 'bin', 'rcedit-x64.exe')
  if (fs.existsSync(local)) return local
  const candidates = [
    process.env.ELECTRON_BUILDER_CACHE ? path.join(process.env.ELECTRON_BUILDER_CACHE, 'winCodeSign') : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign')
      : null
  ].filter(Boolean)
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir)) {
      const candidate = path.join(dir, entry, 'rcedit-x64.exe')
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

function runRcedit(rcedit, args) {
  execFileSync(rcedit, args, { stdio: 'pipe' })
}

module.exports = async function afterPack(context) {
  const appOutDir = context.appOutDir
  if (!appOutDir || !fs.existsSync(appOutDir)) return
  const appInfo = context.packager.appInfo
  const exePath = path.join(appOutDir, `${appInfo.productFilename}.exe`)
  if (!fs.existsSync(exePath)) {
    console.log(`[afterPack] ${exePath} not found, skip icon/version editing`)
    return
  }
  const rcedit = findRcedit()
  if (!rcedit) {
    console.log('[afterPack] rcedit not found, skip icon/version editing')
    return
  }
  const icon = path.join(__dirname, '..', 'resources', 'icon.ico')
  const version = appInfo.version
  const company = appInfo.companyName || appInfo.productName
  const args = [
    exePath,
    '--set-version-string',
    'FileDescription',
    '桌面悬浮球 AI 助手（DeepSeek）',
    '--set-version-string',
    'ProductName',
    appInfo.productName,
    '--set-version-string',
    'LegalCopyright',
    `Copyright © ${new Date().getFullYear()} ${company}`,
    '--set-file-version',
    version,
    '--set-product-version',
    `${version}.0`,
    '--set-version-string',
    'InternalName',
    appInfo.productFilename,
    '--set-version-string',
    'OriginalFilename',
    `${appInfo.productFilename}.exe`,
    '--set-version-string',
    'CompanyName',
    company
  ]
  if (fs.existsSync(icon)) args.push('--set-icon', icon)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      runRcedit(rcedit, args)
      console.log(`[afterPack] icon/version applied to ${path.basename(exePath)} (attempt ${attempt})`)
      return
    } catch (error) {
      const message = String(error.stderr || error.message || error).trim().slice(0, 120)
      if (attempt === MAX_ATTEMPTS) {
        console.log(`[afterPack] rcedit failed after ${MAX_ATTEMPTS} attempts: ${message}`)
        return
      }
      await sleep(RETRY_DELAY_MS)
    }
  }
}
