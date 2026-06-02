import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const tsConfigPathsPlugin = () =>
  viteTsConfigPaths({
    projects: ['./tsconfig.json'],
  })

const config = defineConfig(({ mode }) => {
  if (mode === 'test') {
    return {
      plugins: [tsConfigPathsPlugin(), viteReact()],
    }
  }

  return {
    plugins: [
      devtools(),
      nitro(),
      tsConfigPathsPlugin(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
