import { queryOptions } from '@tanstack/react-query'

import { getEditorDashboard } from './api/editorDashboardClient'
import type { EditorDashboardPeriodT } from './types'

export const editorDashboardQueryKey = ['editor', 'dashboard'] as const

export const editorDashboardQueryOptions = (
  period: EditorDashboardPeriodT = '30d',
) =>
  queryOptions({
    queryKey: [...editorDashboardQueryKey, period] as const,
    queryFn: () => getEditorDashboard(period),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
