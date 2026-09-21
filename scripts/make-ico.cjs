const fs = require('node:fs')
const path = require('node:path')

function buildIco(pngPath, icoPath) {
  const png = fs.readFileSync(pngPath)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0)
  entry.writeUInt8(0, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12)
  fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]))
  console.log(`[make-ico] wrote ${icoPath} (${png.length + 22} bytes)`)
}

const root = path.join(__dirname, '..')
buildIco(path.join(root, 'resources', 'icon.png'), path.join(root, 'resources', 'icon.ico'))
