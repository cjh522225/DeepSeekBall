let rendererUrl: string | null = null

export function setRendererUrl(url: string | null): void {
  rendererUrl = url
}

export function getRendererUrl(): string | null {
  return rendererUrl
}
