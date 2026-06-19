import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import type { DataManagementSearch } from '@/features/data-management/schemas'
import {
  adminProjectStore,
  useAdminProjectCode,
} from '@/features/data-management/store'

export function useDataManagementProjectSelection() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isDataRoute = pathname.startsWith('/app/data')
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  const storedProjectCode = useAdminProjectCode()

  const urlProjectCode =
    typeof search.projectCode === 'string' ? search.projectCode : undefined

  const projectCode = isDataRoute
    ? (urlProjectCode ?? storedProjectCode ?? undefined)
    : (storedProjectCode ?? undefined)

  useEffect(() => {
    if (isDataRoute && urlProjectCode?.trim()) {
      adminProjectStore.setProjectCode(urlProjectCode)
    }
  }, [isDataRoute, urlProjectCode])

  const handleProjectChange = useCallback(
    (nextProjectCode: string) => {
      adminProjectStore.setProjectCode(nextProjectCode)

      if (!isDataRoute) {
        return
      }

      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          projectCode: nextProjectCode,
          nodeId: undefined,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
    },
    [isDataRoute, navigate],
  )

  const syncProjectFromNode = useCallback(
    (nextProjectCode: string, nodeId: string) => {
      adminProjectStore.setProjectCode(nextProjectCode)

      if (!isDataRoute) {
        return
      }

      void navigate({
        to: '.',
        search: (prev: DataManagementSearch) => ({
          ...prev,
          projectCode: nextProjectCode,
          nodeId,
          focusDocumentId: undefined,
          focusGroupIndex: undefined,
        }),
      })
    },
    [isDataRoute, navigate],
  )

  return { projectCode, handleProjectChange, syncProjectFromNode }
}
