import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createPaperSize,
  getPaperSizes,
} from '@/features/plan-management/api/paperSizeClient'
import {
  deleteProjectPlan,
  getProjectPlanById,
  getProjectPlanDetails,
  getProjectPlans,
  updateProjectPlan,
  updateProjectPlanDetails,
} from '@/features/plan-management/api/planManagementClient'
import { submitCreatePlanFlow } from '@/features/plan-management/lib/submitCreatePlanFlow'
import type { CreatePlanFormValues } from '@/features/plan-management/schemas'
import type {
  CreatePaperSizePayloadT,
  GetProjectPlansParamsT,
  UpdateProjectPlanDetailsPayloadT,
  UpdateProjectPlanPayloadT,
} from '@/features/plan-management/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const DEFAULT_PLANS_LIMIT = 50

export const projectPlansQueryKeyPrefix = ['project-plans'] as const

export const paperSizesQueryKeyPrefix = ['paper-sizes'] as const

export const paperSizesQueryOptions = () =>
  queryOptions({
    queryKey: paperSizesQueryKeyPrefix,
    queryFn: () => getPaperSizes(),
    staleTime: 60_000,
  })

export const projectPlanQueryKey = (id: string) =>
  [...projectPlansQueryKeyPrefix, 'detail', id] as const

export const projectPlanDetailsQueryKey = (id: string) =>
  [...projectPlansQueryKeyPrefix, 'detail-items', id] as const

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

export const projectPlanDetailsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: projectPlanDetailsQueryKey(id),
    queryFn: () => getProjectPlanDetails(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  })

export function useCreatePaperSize() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePaperSizePayloadT) => createPaperSize(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: paperSizesQueryKeyPrefix,
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.paperSizeCreateFailed', { ns: 'plan-management' }),
      )
    },
  })
}

export function useCreateProjectPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: CreatePlanFormValues) => submitCreatePlanFlow(values),
    onSuccess: () => {
      toast.success(i18n.t('form.success.create', { ns: 'plan-management' }))
      void queryClient.invalidateQueries({
        queryKey: projectPlansQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: paperSizesQueryKeyPrefix,
      })
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
      void queryClient.invalidateQueries({
        queryKey: projectPlansQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: projectPlanQueryKey(plan.id),
      })
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
      void queryClient.invalidateQueries({
        queryKey: projectPlansQueryKeyPrefix,
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'plan-management' }),
      )
    },
  })
}

export function useUpdateProjectPlanDetails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      planId,
      payload,
    }: {
      planId: string
      payload: UpdateProjectPlanDetailsPayloadT
    }) => updateProjectPlanDetails(planId, payload),
    onSuccess: (_, variables) => {
      toast.success(i18n.t('detail.success.updateTasks', { ns: 'plan-management' }))
      void queryClient.invalidateQueries({
        queryKey: projectPlanDetailsQueryKey(variables.planId),
      })
      void queryClient.invalidateQueries({
        queryKey: projectPlanQueryKey(variables.planId),
      })
    },
    onError: (error: unknown) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.updateTasksFailed', { ns: 'plan-management' }),
      )
    },
  })
}
