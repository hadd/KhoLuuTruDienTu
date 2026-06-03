import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/features/auth/store'
import { env } from '@/lib/utils/env'

let socket: Socket | null = null
let activeConsumers = 0

/** Enable in browser console: localStorage.setItem('debug:ocr-socket', '1') */
export function isOcrSocketDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('debug:ocr-socket') === '1'
}

export function logOcrSocketDebug(
  step: string,
  detail?: unknown,
): void {
  if (!isOcrSocketDebugEnabled()) return
  if (detail === undefined) {
    console.info(`[ocr-socket] ${step}`)
    return
  }
  console.info(`[ocr-socket] ${step}`, detail)
}

export function acquireDossierSocket(): Socket {
  if (!socket) {
    socket = io(env.API_URL, {
      path: '/socket.io',
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => {
        callback({ token: getAccessToken() ?? '' })
      },
    })

    socket.on('connect', () => {
      logOcrSocketDebug('connected', { socketId: socket?.id })
    })
    socket.on('connect_error', (error) => {
      logOcrSocketDebug('connect_error', error.message)
    })
    socket.on('disconnect', (reason) => {
      logOcrSocketDebug('disconnect', reason)
    })
    if (isOcrSocketDebugEnabled()) {
      socket.onAny((event, ...args) => {
        console.info('[ocr-socket] event', event, ...args)
      })
    }
  }

  activeConsumers += 1
  if (!socket.connected && !socket.active) {
    logOcrSocketDebug('connecting', { url: env.API_URL })
    socket.connect()
  }

  return socket
}

export function releaseDossierSocket(): void {
  if (!socket || activeConsumers <= 0) return

  activeConsumers -= 1
  if (activeConsumers === 0) {
    socket.disconnect()
  }
}
