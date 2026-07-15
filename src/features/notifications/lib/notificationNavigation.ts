import type { NavigateOptions } from '@tanstack/react-router'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type { NotificationInboxRecordT } from '@/features/notifications/types'

export interface NotificationNavigationOptionsT {
  dataManagementRole?: DataManagementRole
}

const DATA_PAGE_PATH = '/app/data'

const EMPTY_DATA_SEARCH = {
  dossierId: undefined,
  nodeId: undefined,
  focusDocumentId: undefined,
  focusGroupIndex: undefined,
  projectCode: undefined,
} as const

function buildEditorDataPageNavigation(): NavigateOptions {
  return {
    to: DATA_PAGE_PATH,
    search: { ...EMPTY_DATA_SEARCH },
  }
}

function isDataManagementPath(pathname: string): boolean {
  return pathname === DATA_PAGE_PATH || pathname === `${DATA_PAGE_PATH}/`
}

function parseRelativeActionUrl(actionUrl: string): {
  pathname: string
  searchParams: URLSearchParams
} | null {
  try {
    const url = new URL(actionUrl, 'http://notification.local')
    if (!url.pathname.startsWith('/')) return null
    return { pathname: url.pathname, searchParams: url.searchParams }
  } catch {
    return null
  }
}

function searchParamsToObject(
  searchParams: URLSearchParams,
): Record<string, string | number> {
  const search: Record<string, string | number> = {}
  searchParams.forEach((value, key) => {
    if (!value) return
    if (key === 'focusGroupIndex') {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed >= 0) {
        search[key] = parsed
      }
      return
    }
    search[key] = value
  })
  return search
}

function extractDossierIdFromLegacyActionUrl(actionUrl: string): string | null {
  const patterns = [
    /^\/admin\/dossiers\/([^/?#]+)/,
    /^\/data-entry\/maker\/([^/?#]+)/,
    /^\/data-entry\/checker\/([^/?#]+)/,
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

function resolveFallbackDossierId(
  notification: Pick<NotificationInboxRecordT, 'payload' | 'entityId'>,
): string | null {
  return (
    readPayloadString(notification.payload, 'dossierId') ??
    notification.entityId?.trim() ??
    null
  )
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
  const parsed = parseRelativeActionUrl(actionUrl)
  if (!parsed) return null

  // Native FE routes: trust path + query; editor never focuses a dossier on /app/data.
  if (parsed.pathname.startsWith('/app/')) {
    if (isEditorRole && isDataManagementPath(parsed.pathname)) {
      return buildEditorDataPageNavigation()
    }

    const search = searchParamsToObject(parsed.searchParams)

    if (isDataManagementPath(parsed.pathname)) {
      const dossierId =
        typeof search.dossierId === 'string'
          ? search.dossierId
          : resolveFallbackDossierId(notification)
      const projectCode =
        typeof search.projectCode === 'string'
          ? search.projectCode
          : readPayloadString(notification.payload, 'projectCode')

      // Only pass dossier focus params — `nodeId` from BE (e.g. qc-node-*) may be
      // an intermediate folder; DataManagementPage deep-link resolves the record.
      return {
        to: DATA_PAGE_PATH,
        search: {
          ...EMPTY_DATA_SEARCH,
          dossierId: dossierId ?? undefined,
          projectCode: projectCode ?? undefined,
        },
      }
    }

    return {
      to: parsed.pathname,
      ...(Object.keys(search).length > 0 ? { search } : {}),
    }
  }

  // Legacy BE paths (inbox cũ) → map sang /app/data.
  const dossierId =
    extractDossierIdFromLegacyActionUrl(actionUrl) ??
    resolveFallbackDossierId(notification)

  if (dossierId) {
    if (isEditorRole) {
      return buildEditorDataPageNavigation()
    }

    const projectCode = readPayloadString(notification.payload, 'projectCode')

    return {
      to: DATA_PAGE_PATH,
      search: {
        ...EMPTY_DATA_SEARCH,
        dossierId,
        projectCode,
      },
    }
  }

  return null
}
