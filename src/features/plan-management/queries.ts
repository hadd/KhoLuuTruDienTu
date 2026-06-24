import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createProjectPlan,
  deleteProjectPlan,
  getProjectPlanById,
  getProjectPlans,
  updateProjectPlan,
} from '@/features/plan-management/api/planManagementClient'
import type {
  CreateProjectPlanPayloadT,
  GetProjectPlansParamsT,
  UpdateProjectPlanPayloadT,
} from '@/features/plan-management/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const DEFAULT_PLANS_LIMIT = 50

export const projectPlansQueryKeyPrefix = ['admin', 'project-plans'] as const

export const projectPlanQueryKey = (id: string) =>
  [...projectPlansQueryKeyPrefix, 'detail', id] as const

export const projectPlansQueryKey = (params: GetProjectPlansParamsT) =>
  [...projectPlansQueryKeyPrefix, params] as const

export const projectPlansQueryOptions = (params: GetProjectPlansParamsT) =>
  queryOptions({
    queryKey: projectPlansQueryKey(params),
    queryFn: () =>
      getProjectPlans({
        projectCode: params.projectCode,
        limit: params.limit ?? DEFAULT_PLANS_LIMIT,
        offset: params.offset ?? 0,
      }),
    enabled: Boolean(params.projectCode),
    staleTime: 60_000,
  })

export const projectPlanQueryOptions = (id: string) =>
  queryOptions({
    queryKey: projectPlanQueryKey(id),
    queryFn: () => getProjectPlanById(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  })

export function useCreateProjectPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateProjectPlanPayloadT) => createProjectPlan(payload),
    onSuccess: () => {
      toast.success(i18n.t('form.success.create', { ns: 'plan-management' }))
      void queryClient.invalidateQueries({ queryKey: projectPlansQueryKeyPrefix })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.saveFailed', { ns: 'plan-management' }),
      )
    },
  })
}

export function useUpdateProjectPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateProjectPlanPayloadT
    }) => updateProjectPlan(id, payload),
    onSuccess: (plan) => {
      toast.success(i18n.t('form.success.update', { ns: 'plan-management' }))
      void queryClient.invalidateQueries({ queryKey: projectPlansQueryKeyPrefix })
      void queryClient.invalidateQueries({ queryKey: projectPlanQueryKey(plan.id) })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.saveFailed', { ns: 'plan-management' }),
      )
    },
  })
}

export function useDeleteProjectPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProjectPlan(id),
    onSuccess: () => {
      toast.success(i18n.t('delete.success', { ns: 'plan-management' }))
      void queryClient.invalidateQueries({ queryKey: projectPlansQueryKeyPrefix })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'plan-management' }),
      )
    },
  })
}
