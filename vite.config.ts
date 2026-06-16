/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000'
  const socketViaProxy = env.VITE_SOCKET_VIA_PROXY === 'true'

  return {
    plugins: [
      devtools(),
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/routeTree.gen.ts',
        autoCodeSplitting: true,
      }),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      viteReact(),
    ],
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
    server: {
      watch: {
        // Cấu hình chokidar để delay việc reload
        awaitWriteFinish: {
          // Thời gian chờ (ms) sau lần thay đổi cuối cùng trước khi reload
          // 2000ms (2s) là mức an toàn cho AI generate code
          stabilityThreshold: 2000,

          // Tần suất kiểm tra kích thước file (ms)
          pollInterval: 500,
        },
      },
      ...(socketViaProxy
        ? {
            proxy: {
              '/socket.io': {
                target: apiUrl,
                ws: true,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  }
})

export default config
