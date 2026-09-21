import { create } from 'zustand'
import type { PublicSettings, SettingsPatch } from '../../../shared/types'

interface SettingsState {
  settings: PublicSettings | null
  dark: boolean
  load: () => Promise<PublicSettings>
  patch: (patch: SettingsPatch) => Promise<PublicSettings>
  refresh: () => Promise<PublicSettings>
  setDark: (dark: boolean) => void
  replace: (settings: PublicSettings) => void
}

function resolveDark(settings: PublicSettings, currentDark: boolean): boolean {
  if (settings.theme === 'dark') return true
  if (settings.theme === 'light') return false
  return currentDark
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  dark: false,
  load: async () => {
    const settings = await window.api.settings.get()
    set((state) => ({ settings, dark: resolveDark(settings, state.dark) }))
    return settings
  },
  patch: async (patch) => {
    const settings = await window.api.settings.set(patch)
    set((state) => ({ settings, dark: resolveDark(settings, state.dark) }))
    return settings
  },
  refresh: async () => {
    const settings = await window.api.settings.get()
    set((state) => ({ settings, dark: resolveDark(settings, state.dark) }))
    return settings
  },
  setDark: (dark) => set({ dark }),
  replace: (settings) => set((state) => ({ settings, dark: resolveDark(settings, state.dark) }))
}))
