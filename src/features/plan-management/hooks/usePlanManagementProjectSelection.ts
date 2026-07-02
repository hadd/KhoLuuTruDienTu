import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import {
  adminProjectStore,
  useAdminProjectCode,
} from '@/features/data-management/store'
import type { PlanSearchT } from '@/features/plan-management/schemas'

const routeApi = getRouteApi('/app/plan-management/')

export function usePlanManagementProjectSelection() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const storedProjectCode = useAdminProjectCode()

  const viewAll = search.viewAll === true
  const urlProjectCode = search.projectCode?.trim() || undefined
  const projectCode = viewAll
    ? undefined
    : (urlProjectCode ?? storedProjectCode ?? undefined)

  useEffect(() => {
    if (urlProjectCode && !viewAll) {
      adminProjectStore.setProjectCode(urlProjectCode)
    }
  }, [urlProjectCode, viewAll])

  useEffect(() => {
    if (!viewAll && !urlProjectCode && storedProjectCode) {
      void navigate({
        to: '.',
        search: (prev: PlanSearchT) => ({
          ...prev,
          projectCode: storedProjectCode,
          viewAll: false,
        }),
        replace: true,
      })
    }
  }, [navigate, storedProjectCode, urlProjectCode, viewAll])

  const handleProjectChange = useCallback(
    (nextProjectCode: string) => {
      adminProjectStore.setProjectCode(nextProjectCode)
      void navigate({
        to: '.',
        search: (prev: PlanSearchT) => ({
          ...prev,
          projectCode: nextProjectCode,
          viewAll: false,
          offset: 0,
        }),
      })
    },
    [navigate],
  )

  const handleViewAllProjects = useCallback(() => {
    void navigate({
      to: '.',
      search: (prev: PlanSearchT) => ({
        ...prev,
        projectCode: undefined,
        viewAll: true,
        offset: 0,
      }),
    })
  }, [navigate])

  return {
    projectCode,
    viewAll,
    handleProjectChange,
    handleViewAllProjects,
  }
}
