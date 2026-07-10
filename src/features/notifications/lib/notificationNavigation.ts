import type { NavigateOptions } from '@tanstack/react-router'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type { NotificationInboxRecordT } from '@/features/notifications/types'

export interface NotificationNavigationOptionsT {
  dataManagementRole?: DataManagementRole
}

function buildEditorDataPageNavigation(): NavigateOptions {
  return {
    to: '/app/data',
    search: {
      dossierId: undefined,
      nodeId: undefined,
      focusDocumentId: undefined,
      focusGroupIndex: undefined,
      projectCode: undefined,
    },
  }
}

function extractDossierIdFromActionUrl(actionUrl: string): string | null {
  const patterns = [
    /^\/admin\/dossiers\/([^/]+)/,
    /^\/data-entry\/maker\/([^/]+)/,
    /^\/data-entry\/checker\/([^/]+)/,
  ]

  for (const pattern of patterns) {
    const match = actionUrl.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

function readPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = payload?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function buildNotificationNavigation(
  notification: Pick<
    NotificationInboxRecordT,
    'actionUrl' | 'payload' | 'entityId'
  >,
  options?: NotificationNavigationOptionsT,
): NavigateOptions | null {
  const actionUrl = notification.actionUrl?.trim()
  if (!actionUrl) return null

  const isEditorRole = options?.dataManagementRole === 'editor'

  if (actionUrl.startsWith('/app/')) {
    if (isEditorRole && actionUrl.startsWith('/app/data')) {
      return buildEditorDataPageNavigation()
    }

    return { to: actionUrl }
  }

  const dossierId =
    extractDossierIdFromActionUrl(actionUrl) ??
    readPayloadString(notification.payload, 'dossierId') ??
    notification.entityId?.trim() ??
    null

  if (dossierId) {
    if (isEditorRole) {
      return buildEditorDataPageNavigation()
    }

    const projectCode = readPayloadString(notification.payload, 'projectCode')

    return {
      to: '/app/data',
      search: {
        dossierId,
        projectCode,
        nodeId: undefined,
        focusDocumentId: undefined,
        focusGroupIndex: undefined,
      },
    }
  }

  return null
}
