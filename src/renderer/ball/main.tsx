import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/global.css'
import '../styles/ball.css'

function Ball(): JSX.Element {
  const [streaming, setStreaming] = useState(false)
  const [size, setSize] = useState(64)
  const [opacity, setOpacity] = useState(1)
  const [pressed, setPressed] = useState(false)
  const drag = useRef({ moved: false, startX: 0, startY: 0, dragging: false })

  useEffect(() => {
    const refreshAppearance = (): void => {
      void window.api.settings.get().then((s) => {
        setSize(s.ballSize)
        setOpacity(s.ballOpacity)
      })
    }
    refreshAppearance()
    const offStreaming = window.api.ball.onStreaming(setStreaming)
    const offAppearance = window.api.ball.onAppearance(refreshAppearance)
    return () => {
      offStreaming()
      offAppearance()
    }
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    drag.current = {
      moved: false,
      startX: event.screenX,
      startY: event.screenY,
      dragging: true
    }
    setPressed(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    window.api.ball.dragStart()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const state = drag.current
    if (!state.dragging) return
    if (
      Math.abs(event.screenX - state.startX) > 4 ||
      Math.abs(event.screenY - state.startY) > 4
    ) {
      state.moved = true
    }
  }

  const onPointerUp = (): void => {
    const state = drag.current
    if (!state.dragging) return
    state.dragging = false
    setPressed(false)
    window.api.ball.dragEnd()
    if (!state.moved) window.api.ball.click()
  }

  const onContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault()
    window.api.ball.contextMenu()
  }

  return (
    <div className="ball-stage">
      <button
        type="button"
        className={`ball-button ${streaming ? 'is-streaming' : ''} ${pressed ? 'is-pressed' : ''}`}
        style={{ width: size, height: size, opacity }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        title={streaming ? '正在生成…（点击查看）' : '点击打开 AI 助手 · 拖动调整位置 · 右键菜单'}
      >
        <span className="ball-glow" />
        <span className="ball-inner">
          {streaming ? (
            <span className="ball-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" className="ball-icon" aria-hidden="true">
              <path
                d="M12 2.6l1.82 5.4a1 1 0 0 0 .62.62l5.4 1.82-5.4 1.82a1 1 0 0 0-.62.62L12 18.28l-1.82-5.4a1 1 0 0 0-.62-.62l-5.4-1.82 5.4-1.82a1 1 0 0 0 .62-.62L12 2.6z"
                fill="currentColor"
              />
              <circle cx="18.6" cy="18.4" r="1.9" fill="currentColor" opacity="0.85" />
            </svg>
          )}
        </span>
      </button>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<Ball />)
