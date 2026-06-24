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

  const urlProjectCode = search.projectCode?.trim() || undefined
  const projectCode = urlProjectCode ?? storedProjectCode ?? undefined

  useEffect(() => {
    if (urlProjectCode) {
      adminProjectStore.setProjectCode(urlProjectCode)
    }
  }, [urlProjectCode])

  useEffect(() => {
    if (!urlProjectCode && storedProjectCode) {
      void navigate({
        to: '.',
        search: (prev: PlanSearchT) => ({
          ...prev,
          projectCode: storedProjectCode,
        }),
        replace: true,
      })
    }
  }, [navigate, storedProjectCode, urlProjectCode])

  const handleProjectChange = useCallback(
    (nextProjectCode: string) => {
      adminProjectStore.setProjectCode(nextProjectCode)
      void navigate({
        to: '.',
        search: (prev: PlanSearchT) => ({
          ...prev,
          projectCode: nextProjectCode,
          offset: 0,
        }),
      })
    },
    [navigate],
  )

  return { projectCode, handleProjectChange }
}
