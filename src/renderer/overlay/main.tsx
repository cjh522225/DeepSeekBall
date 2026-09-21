import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import type { CaptureInitPayload } from '../../shared/types'
import '../styles/overlay.css'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function normalise(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

function Overlay(): JSX.Element {
  const [init, setInit] = useState<CaptureInitPayload | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const rectRef = useRef<Rect | null>(null)
  const initRef = useRef<CaptureInitPayload | null>(null)

  useEffect(() => {
    const off = window.api.capture.onInit((payload) => {
      setInit(payload)
      initRef.current = payload
    })
    return () => off()
  }, [])

  const confirm = useCallback(() => {
    const current = rectRef.current
    const currentInit = initRef.current
    if (!current || !currentInit) return
    if (current.width < 6 || current.height < 6) {
      window.api.capture.cancel()
      return
    }
    const image = new Image()
    image.onload = () => {
      const scale = currentInit.scaleFactor || 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(current.width * scale))
      canvas.height = Math.max(1, Math.round(current.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        window.api.capture.cancel()
        return
      }
      ctx.drawImage(
        image,
        Math.round(current.x * scale),
        Math.round(current.y * scale),
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      )
      const dataUrl = canvas.toDataURL('image/png')
      window.api.capture.submit({
        pngBase64: dataUrl.replace(/^data:image\/png;base64,/, ''),
        width: canvas.width,
        height: canvas.height
      })
    }
    image.onerror = () => window.api.capture.cancel()
    image.src = currentInit.dataUrl
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.api.capture.cancel()
      if (event.key === 'Enter') confirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      window.api.capture.cancel()
      return
    }
    const point = { x: event.clientX, y: event.clientY }
    start.current = point
    setDragging(true)
    setRect({ x: point.x, y: point.y, width: 0, height: 0 })
    rectRef.current = { x: point.x, y: point.y, width: 0, height: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragging || !start.current) return
    const next = normalise(start.current, { x: event.clientX, y: event.clientY })
    setRect(next)
    rectRef.current = next
  }

  const onPointerUp = (): void => {
    if (!dragging) return
    setDragging(false)
    const current = rectRef.current
    if (current && current.width >= 8 && current.height >= 8) confirm()
  }

  return (
    <div
      className="overlay-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => {
        e.preventDefault()
        window.api.capture.cancel()
      }}
    >
      {init ? (
        <>
          <img className="overlay-shot" src={init.dataUrl} draggable={false} alt="" />
          <div className="overlay-dim" />
          {rect ? (
            <div
              className="overlay-selection"
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            />
          ) : null}
          {rect && rect.width > 4 && rect.height > 4 ? (
            <div
              className="overlay-size"
              style={{
                left: rect.x,
                top: Math.max(8, rect.y - 26)
              }}
            >
              {Math.round(rect.width)} × {Math.round(rect.height)}
            </div>
          ) : null}
          <div className="overlay-hint">拖动鼠标选择区域（松手即确认） · Esc 或右键取消</div>
        </>
      ) : null}
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<Overlay />)
