import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'
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

  // Default the data-management route to "Tất cả" (all projects) so entering the
  // page always shows the folder tree, even before any project is selected.
  const projectCode = isDataRoute
    ? (urlProjectCode && urlProjectCode !== ALL_PROJECTS_CODE
        ? urlProjectCode
        : ALL_PROJECTS_CODE)
    : (storedProjectCode ?? undefined)

  useEffect(() => {
    if (!isDataRoute || !urlProjectCode?.trim()) {
      return
    }
    if (urlProjectCode.trim() === ALL_PROJECTS_CODE) {
      adminProjectStore.clearProjectCode()
      return
    }
    adminProjectStore.setProjectCode(urlProjectCode)
  }, [isDataRoute, urlProjectCode])

  const handleProjectChange = useCallback(
    (nextProjectCode: string) => {
      if (!isDataRoute) {
        if (nextProjectCode === ALL_PROJECTS_CODE) {
          adminProjectStore.clearProjectCode()
        } else {
          adminProjectStore.setProjectCode(nextProjectCode)
        }
        return
      }

      if (nextProjectCode === ALL_PROJECTS_CODE) {
        adminProjectStore.clearProjectCode()
        void navigate({
          to: '.',
          search: (prev: DataManagementSearch) => ({
            ...prev,
            projectCode: undefined,
            nodeId: undefined,
            focusDocumentId: undefined,
            focusGroupIndex: undefined,
          }),
        })
        return
      }

      adminProjectStore.setProjectCode(nextProjectCode)

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
