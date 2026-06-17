import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/features/auth/store'
import { ensureFreshAccessToken } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

let socket: Socket | null = null
let activeConsumers = 0
let authRetryInFlight = false

/** Enable in browser console: localStorage.setItem('debug:ocr-socket', '1') */
export function isOcrSocketDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('debug:ocr-socket') === '1'
}

let devVerificationHintLogged = false

function shouldLogOcrSocket(): boolean {
  return isOcrSocketDebugEnabled()
}

function logOcrSocketInfo(step: string, detail?: unknown): void {
  if (!shouldLogOcrSocket()) return
  if (detail === undefined) {
    console.info(`[ocr-socket] ${step}`)
    return
  }
  console.info(`[ocr-socket] ${step}`, detail)
}

/** Debug-only: how to tell FE join OK vs BE not emitting. */
function logDevVerificationHint(): void {
  if (!isOcrSocketDebugEnabled() || devVerificationHintLogged) return
  devVerificationHintLogged = true
  console.info(
    '[ocr-socket] Join OK if you see emit join:folder/dossier. ' +
      'If no "event ocr:completed" after OCR finishes, check BE log for "[Socket.IO] ocr:completed emitted" (handleOcrCallback must run with applied=true).',
  )
}

export function logOcrSocketDebug(
  step: string,
  detail?: unknown,
): void {
  if (!isOcrSocketDebugEnabled()) return
  logOcrSocketInfo(step, detail)
}

/** Socket connect URL: same-origin when proxy mode, otherwise SOCKET_URL. */
export function getSocketConnectUrl(): string {
  if (typeof window !== 'undefined' && env.SOCKET_VIA_PROXY) {
    return window.location.origin
  }
  return env.SOCKET_URL
}

function isAuthConnectError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('authentication') ||
    normalized.includes('unauthorized') ||
    normalized.includes('jwt') ||
    normalized.includes('token')
  )
}

function attachSocketInstrumentation(activeSocket: Socket): void {
  activeSocket.on('connect', () => {
    logDevVerificationHint()
    logOcrSocketInfo('connected', {
      socketId: activeSocket.id,
      transport: activeSocket.io.engine?.transport?.name,
      url: getSocketConnectUrl(),
    })
  })

  activeSocket.on('connect_error', (error) => {
    logOcrSocketInfo('connect_error', {
      message: error.message,
      url: getSocketConnectUrl(),
    })

    if (!authRetryInFlight && isAuthConnectError(error.message)) {
      authRetryInFlight = true
      void ensureFreshAccessToken()
        .then((token) => {
          if (!token || !socket) return
          socket.auth = { token }
          if (!socket.connected) {
            logOcrSocketInfo('retry connect after auth refresh')
            socket.connect()
          }
        })
        .finally(() => {
          authRetryInFlight = false
        })
    }
  })

  activeSocket.on('disconnect', (reason) => {
    logOcrSocketInfo('disconnect', reason)
  })

  activeSocket.io.on('open', () => {
    logOcrSocketInfo('engine open', {
      transport: activeSocket.io.engine?.transport?.name,
    })
  })

  if (isOcrSocketDebugEnabled()) {
    activeSocket.onAny((event, ...args) => {
      console.info('[ocr-socket] event', event, ...args)
    })
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__ocrSocket = activeSocket
  }
}

function createDossierSocket(): Socket {
  const connectUrl = getSocketConnectUrl()
  logOcrSocketInfo('creating socket', {
    url: connectUrl,
    viaProxy: env.SOCKET_VIA_PROXY,
    socketUrl: env.SOCKET_URL,
  })

  const instance = io(connectUrl, {
    path: '/socket.io',
    autoConnect: false,
    withCredentials: true,
    auth: (callback) => {
      void ensureFreshAccessToken().then((token) => {
        callback({ token: token ?? getAccessToken() ?? '' })
      })
    },
  })

  attachSocketInstrumentation(instance)
  return instance
}

export function acquireDossierSocket(): Socket {
  if (!socket) {
    socket = createDossierSocket()
  }

  activeConsumers += 1
  if (!socket.connected && !socket.active) {
    logOcrSocketInfo('connecting', { url: getSocketConnectUrl() })
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

export function disconnectDossierSocket(): void {
  if (!socket) return
  activeConsumers = 0
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  if (typeof window !== 'undefined') {
    delete window.__ocrSocket
  }
}
