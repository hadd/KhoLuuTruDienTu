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
    /[?&]dossierId=([^&]+)/,
  ]

  for (const pattern of patterns) {
    const match = actionUrl.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

export function buildNotificationNavigation(
  notification: Pick<NotificationInboxRecordT, 'actionUrl'>,
  options?: NotificationNavigationOptionsT,
): NavigateOptions | null {
  const actionUrl = notification.actionUrl?.trim()
  if (!actionUrl) return null

  const isEditorRole = options?.dataManagementRole === 'editor'
  const parsed = parseRelativeActionUrl(actionUrl)
  if (!parsed) return null

  if (parsed.pathname.startsWith('/app/')) {
    if (isEditorRole && isDataManagementPath(parsed.pathname)) {
      return buildEditorDataPageNavigation()
    }

    const search = searchParamsToObject(parsed.searchParams)

    if (isDataManagementPath(parsed.pathname)) {
      const dossierId =
        typeof search.dossierId === 'string'
          ? search.dossierId
          : extractDossierIdFromLegacyActionUrl(actionUrl) ?? undefined
      const projectCode =
        typeof search.projectCode === 'string' ? search.projectCode : undefined

      return {
        to: DATA_PAGE_PATH,
        search: {
          ...EMPTY_DATA_SEARCH,
          dossierId,
          projectCode,
        },
      }
    }

    return {
      to: parsed.pathname,
      ...(Object.keys(search).length > 0 ? { search } : {}),
    }
  }

  const dossierId = extractDossierIdFromLegacyActionUrl(actionUrl)

  if (dossierId) {
    if (isEditorRole) {
      return buildEditorDataPageNavigation()
    }

    return {
      to: DATA_PAGE_PATH,
      search: {
        ...EMPTY_DATA_SEARCH,
        dossierId,
      },
    }
  }

  return null
}
