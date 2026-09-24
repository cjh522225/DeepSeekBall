import { useEffect, useRef, useState } from 'react'
import { Composer } from './components/Composer'
import { ConversationDrawer } from './components/ConversationDrawer'
import { Header } from './components/Header'
import { MessageList } from './components/MessageList'
import { SettingsView } from './components/SettingsView'
import { Toast } from './components/Toast'
import { ToolConfirmDialog } from './components/ToolConfirmDialog'
import { useChatStore } from './stores/chatStore'
import { useConvStore } from './stores/convStore'
import { useMcpStore } from './stores/mcpStore'
import { useSettingsStore } from './stores/settingsStore'

export default function App(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dark = useSettingsStore((s) => s.dark)
  const agentMode = useSettingsStore((s) => s.settings?.agentMode ?? 'build')
  const patchSettings = useSettingsStore((s) => s.patch)
  const currentId = useConvStore((s) => s.currentId)
  const list = useConvStore((s) => s.list)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const title = list.find((c) => c.id === currentId)?.title ?? '新会话'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  async function newChat(): Promise<void> {
    const meta = await useConvStore.getState().create()
    await useChatStore.getState().loadConversation(meta.id)
    setView('chat')
    setDrawerOpen(false)
  }

  function collapse(): void {
    setOpen(false)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      window.api.panel.hide()
      hideTimer.current = null
    }, 190)
  }

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      const settings = await useSettingsStore.getState().load()
      if (settings.theme === 'system') {
        useSettingsStore
          .getState()
          .setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
      const conversations = await window.api.conv.list()
      useConvStore.setState({ list: conversations })
      if (conversations.length > 0) {
        await useConvStore.getState().select(conversations[0].id)
      }
      await useMcpStore.getState().load()
    }
    void bootstrap()

    const offs = [
      window.api.panel.onShow(() => {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
        setOpen(true)
        void useSettingsStore.getState().refresh()
        void useConvStore.getState().load()
      }),
      window.api.panel.onCollapseRequest(() => {
        setOpen(false)
        if (hideTimer.current) clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => {
          window.api.panel.hide()
          hideTimer.current = null
        }, 190)
      }),
      window.api.settings.onTheme((isDark) => useSettingsStore.getState().setDark(isDark)),
      window.api.chat.onChunk((event) => useChatStore.getState().handleChunk(event)),
      window.api.chat.onDone((event) => useChatStore.getState().handleDone(event)),
      window.api.chat.onError((event) => useChatStore.getState().handleError(event)),
      window.api.chat.onToolCall((event) => useChatStore.getState().handleToolCall(event)),
      window.api.chat.onToolConfirmRequest((event) =>
        useChatStore.getState().handleToolConfirm(event)
      ),
      window.api.mcp.onStatus((status) => useMcpStore.getState().setStatus(status)),
      window.api.mcp.onTools(({ serverId, tools }) =>
        useMcpStore.getState().setTools(serverId, tools)
      ),
      window.api.composer.onInsert((payload) => {
        const chat = useChatStore.getState()
        setView('chat')
        setDrawerOpen(false)
        if (payload.mode === 'quote' && payload.text) chat.setQuote(payload.text)
        if (payload.attachment) chat.addAttachment(payload.attachment)
      }),
      window.api.composer.onToast((toast) => useChatStore.getState().showToast(toast)),
      window.api.composer.onMenu(({ action }) => {
        setDrawerOpen(false)
        if (action === 'new-conversation') void newChat()
        if (action === 'settings') setView('settings')
      })
    ]
    return () => {
      offs.forEach((off) => off())
    }
  }, [])

  return (
    <div className="panel-stage">
      <div className={`panel-card ${open ? 'open' : ''}`}>
        <Header
          title={title}
          view={view}
          mode={agentMode}
          onModeChange={(next) => void patchSettings({ agentMode: next })}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          onNewChat={() => void newChat()}
          onOpenSettings={() => setView(view === 'settings' ? 'chat' : 'settings')}
          onCollapse={collapse}
        />
        {view === 'chat' ? (
          <>
            <MessageList />
            <Composer />
          </>
        ) : (
          <SettingsView />
        )}
        <ConversationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <Toast />
        <ToolConfirmDialog />
      </div>
    </div>
  )
}
