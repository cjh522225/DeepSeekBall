import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          panel: resolve(__dirname, 'src/renderer/panel/index.html'),
          ball: resolve(__dirname, 'src/renderer/ball/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html')
        }
      }
    }
  }
})
