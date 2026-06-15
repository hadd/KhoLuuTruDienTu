import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

import { getAccessToken } from '@/features/auth/store'
import type {
  OcrCompletedHandler,
  OcrCompletedPayloadT,
  SocketRoomSetsT,
} from '@/lib/socket/types'
import { parseOcrCompletedPayload } from '@/lib/socket/types'
import { env } from '@/lib/utils/env'

const OCR_COMPLETED_EVENT = 'ocr:completed'

let socket: Socket | null = null
let activeConsumers = 0
let ocrHandler: OcrCompletedHandler | null = null
const joinedFolderIds = new Set<string>()
const joinedDossierIds = new Set<string>()

/** Enable in browser console: localStorage.setItem('debug:ocr-socket', '1') */
export function isOcrSocketDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('debug:ocr-socket') === '1'
}

export function logOcrSocketDebug(step: string, detail?: unknown): void {
  if (!isOcrSocketDebugEnabled()) return
  if (detail === undefined) {
    console.info(`[ocr-socket] ${step}`)
    return
  }
  console.info(`[ocr-socket] ${step}`, detail)
}

function rejoinAllTrackedRooms(): void {
  if (!socket?.connected) return

  for (const folderId of joinedFolderIds) {
    socket.emit('join:folder', folderId)
    logOcrSocketDebug('emit join:folder', folderId)
  }
  for (const dossierId of joinedDossierIds) {
    socket.emit('join:dossier', dossierId)
    logOcrSocketDebug('emit join:dossier', dossierId)
  }
}

function ensureSocket(): Socket {
  if (socket) return socket

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
    rejoinAllTrackedRooms()
  })

  socket.on('disconnect', (reason) => {
    logOcrSocketDebug('disconnected', reason)
  })

  socket.on('connect_error', (error) => {
    logOcrSocketDebug('connect_error', error.message)
  })

  socket.on(OCR_COMPLETED_EVENT, (raw: unknown) => {
    logOcrSocketDebug('ocr:completed received', raw)

    const payload = parseOcrCompletedPayload(raw)
    if (!payload) {
      logOcrSocketDebug('ignored invalid ocr:completed payload', raw)
      return
    }
    ocrHandler?.(payload)
  })

  if (isOcrSocketDebugEnabled()) {
    socket.onAny((event, ...args) => {
      console.info('[ocr-socket] event', event, ...args)
    })
  }

  return socket
}

function emitJoinLeave(
  eventPrefix: 'folder' | 'dossier',
  id: string,
  action: 'join' | 'leave',
): void {
  const event = `${action}:${eventPrefix}`
  const targetSet =
    eventPrefix === 'folder' ? joinedFolderIds : joinedDossierIds

  if (action === 'join') {
    targetSet.add(id)
    if (socket?.connected) {
      socket.emit(event, id)
      logOcrSocketDebug(`emit ${event}`, id)
    }
    return
  }

  targetSet.delete(id)
  if (socket?.connected) {
    socket.emit(event, id)
    logOcrSocketDebug(`emit ${event}`, id)
  }
}

function syncSetDelta(
  prefix: 'folder' | 'dossier',
  currentSet: Set<string>,
  nextIds: Array<string>,
): void {
  const nextSet = new Set(nextIds.filter((id) => id.trim()))

  for (const id of [...currentSet]) {
    if (!nextSet.has(id)) {
      emitJoinLeave(prefix, id, 'leave')
    }
  }

  for (const id of nextSet) {
    if (!currentSet.has(id)) {
      emitJoinLeave(prefix, id, 'join')
    }
  }
}

export function acquireDataManagementSocket(): Socket {
  const instance = ensureSocket()
  activeConsumers += 1

  if (!instance.connected && !instance.active) {
    logOcrSocketDebug('connecting', { url: env.API_URL })
    instance.connect()
  }

  return instance
}

export function releaseDataManagementSocket(): void {
  if (!socket || activeConsumers <= 0) return

  activeConsumers -= 1
  if (activeConsumers === 0) {
    socket.disconnect()
  }
}

export function disconnectDataManagementSocket(): void {
  if (!socket) return

  activeConsumers = 0
  joinedFolderIds.clear()
  joinedDossierIds.clear()
  ocrHandler = null
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  logOcrSocketDebug('disconnect (forced)')
}

export function syncDataManagementSocketRoomSets(rooms: SocketRoomSetsT): void {
  syncSetDelta('folder', joinedFolderIds, rooms.folderIds)
  syncSetDelta('dossier', joinedDossierIds, rooms.dossierIds)
  logOcrSocketDebug('rooms', rooms)
}

export function subscribeOcrCompleted(handler: OcrCompletedHandler): void {
  ocrHandler = handler
}

export function unsubscribeOcrCompleted(): void {
  ocrHandler = null
}

export type { OcrCompletedPayloadT }
