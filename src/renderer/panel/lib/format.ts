export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day && new Date(timestamp).getDate() === new Date(now).getDate()) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function toFileUrl(filePath: string): string {
  const normalized = encodeURI(filePath.replace(/\\/g, '/'))
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')
  return `dsfile:///${normalized}`
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}
