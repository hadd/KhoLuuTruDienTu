import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { adminProjectStore } from '@/features/data-management/store'
import type { PlanSearchT } from '@/features/plan-management/schemas'

const routeApi = getRouteApi('/app/plan-management/')

export function usePlanManagementProjectSelection() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const viewAll = search.viewAll !== false
  const urlProjectCode = search.projectCode?.trim() || undefined
  const projectCode = viewAll
    ? undefined
    : urlProjectCode

  useEffect(() => {
    if (urlProjectCode && !viewAll) {
      adminProjectStore.setProjectCode(urlProjectCode)
    }
  }, [urlProjectCode, viewAll])

  const handleProjectChange = useCallback(
    (nextProjectCode: string) => {
      adminProjectStore.setProjectCode(nextProjectCode)
      void navigate({
        to: '.',
        search: (prev: PlanSearchT) => ({
          ...prev,
          projectCode: nextProjectCode,
          viewAll: false,
          page: 1,
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
        page: 1,
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
