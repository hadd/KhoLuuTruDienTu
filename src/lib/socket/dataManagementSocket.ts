import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/features/auth/store'
import type {
  OcrCompletedHandler,
  OcrCompletedPayloadT,
  SocketRoomsT,
} from '@/lib/socket/types'
import { parseOcrCompletedPayload } from '@/lib/socket/types'
import { env } from '@/lib/utils/env'

const OCR_COMPLETED_EVENT = 'ocr:completed'

let socket: Socket | null = null
let ocrHandler: OcrCompletedHandler | null = null
let rejoinOnConnect: (() => void) | null = null
let activeRooms: SocketRoomsT = { folderId: null, dossierId: null }

function devLog(message: string, detail?: unknown) {
  if (!import.meta.env.DEV) return
  if (detail !== undefined) {
    console.debug(`[data-management-socket] ${message}`, detail)
  } else {
    console.debug(`[data-management-socket] ${message}`)
  }
}

function ensureSocket(): Socket {
  if (socket) return socket

  socket = io(env.API_URL, {
    path: '/socket.io',
    auth: { token: getAccessToken() },
    withCredentials: true,
    autoConnect: false,
  })

  socket.on('connect', () => {
    devLog('connected')
    rejoinOnConnect?.()
  })

  socket.on('disconnect', (reason) => {
    devLog('disconnected', reason)
  })

  socket.on('connect_error', (error) => {
    devLog('connect_error', error.message)
  })

  socket.on(OCR_COMPLETED_EVENT, (raw: unknown) => {
    const payload = parseOcrCompletedPayload(raw)
    if (!payload) {
      devLog('ignored invalid ocr:completed payload', raw)
      return
    }
    ocrHandler?.(payload)
  })

  return socket
}

function emitJoinLeave(
  eventPrefix: 'folder' | 'dossier',
  id: string | null,
  action: 'join' | 'leave',
) {
  if (!id || !socket?.connected) return
  const event = `${action}:${eventPrefix}`
  socket.emit(event, id)
  devLog(event, id)
}

export function connectDataManagementSocket(): void {
  const instance = ensureSocket()
  if (instance.connected) return
  instance.auth = { token: getAccessToken() }
  instance.connect()
}

export function disconnectDataManagementSocket(): void {
  if (!socket) return
  activeRooms = { folderId: null, dossierId: null }
  ocrHandler = null
  rejoinOnConnect = null
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  devLog('disconnect')
}

export function joinFolder(folderId: string): void {
  emitJoinLeave('folder', folderId, 'join')
}

export function leaveFolder(folderId: string): void {
  emitJoinLeave('folder', folderId, 'leave')
}

export function joinDossier(dossierId: string): void {
  emitJoinLeave('dossier', dossierId, 'join')
}

export function leaveDossier(dossierId: string): void {
  emitJoinLeave('dossier', dossierId, 'leave')
}

function applyRoomDelta(previous: SocketRoomsT, next: SocketRoomsT): void {
  if (previous.folderId && previous.folderId !== next.folderId) {
    leaveFolder(previous.folderId)
  }
  if (previous.dossierId && previous.dossierId !== next.dossierId) {
    leaveDossier(previous.dossierId)
  }

  if (next.folderId && next.folderId !== previous.folderId) {
    joinFolder(next.folderId)
  }
  if (next.dossierId && next.dossierId !== previous.dossierId) {
    joinDossier(next.dossierId)
  }

  activeRooms = next
}

export function syncDataManagementSocketRooms(rooms: SocketRoomsT): void {
  const previous = activeRooms
  applyRoomDelta(previous, rooms)

  rejoinOnConnect = () => {
    if (activeRooms.folderId) joinFolder(activeRooms.folderId)
    if (activeRooms.dossierId) joinDossier(activeRooms.dossierId)
  }
}

export function subscribeOcrCompleted(handler: OcrCompletedHandler): void {
  ocrHandler = handler
}

export type { OcrCompletedPayloadT }
