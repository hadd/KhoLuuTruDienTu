import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createSecurityLevelRecord,
  createSecurityPermissionDef,
  deleteSecurityLevelRecord,
  deleteSecurityPermissionDef,
  getActiveSecurityLevels,
  getSecurityLevels,
  getSecurityPermissionDefs,
  updateSecurityLevelRecord,
  updateSecurityPermissionDef,
} from '@/features/security-level/api/securityLevelClient'
import type {
  CreateSecurityLevelPayloadT,
  GetSecurityLevelsParamsT,
  UpdateSecurityLevelPayloadT,
} from '@/features/security-level/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const securityLevelsQueryKeyPrefix = ['admin', 'security-levels'] as const
export const activeSecurityLevelsQueryKey = [
  'catalog',
  'security-levels',
  'active',
] as const
export const securityPermissionDefsQueryKeyPrefix = [
  'admin',
  'security-permission-defs',
] as const

export const securityLevelsQueryKey = (params?: GetSecurityLevelsParamsT) =>
  [...securityLevelsQueryKeyPrefix, params ?? {}] as const

export const securityPermissionDefsQueryKey = (params?: {
  page?: number
  limit?: number
  search?: string
}) => [...securityPermissionDefsQueryKeyPrefix, params ?? {}] as const

export const securityLevelsQueryOptions = (params?: GetSecurityLevelsParamsT) =>
  queryOptions({
    queryKey: securityLevelsQueryKey(params),
    queryFn: () => getSecurityLevels(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

export const activeSecurityLevelsQueryOptions = () =>
  queryOptions({
    queryKey: activeSecurityLevelsQueryKey,
    queryFn: getActiveSecurityLevels,
    staleTime: 60_000,
  })

export const securityPermissionDefsQueryOptions = (params?: {
  page?: number
  limit?: number
  search?: string
}) =>
  queryOptions({
    queryKey: securityPermissionDefsQueryKey(params),
    queryFn: () => getSecurityPermissionDefs(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

function invalidateSecurityLevelQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: securityLevelsQueryKeyPrefix,
  })
  void queryClient.invalidateQueries({
    queryKey: activeSecurityLevelsQueryKey,
  })
}

function invalidatePermissionDefQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: securityPermissionDefsQueryKeyPrefix,
  })
  void queryClient.invalidateQueries({
    queryKey: ['security-level-rules'],
  })
}

export function useCreateSecurityLevel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateSecurityLevelPayloadT) =>
      createSecurityLevelRecord(payload),
    onSuccess: () => {
      invalidateSecurityLevelQueries(queryClient)
      toast.success(i18n.t('form.success.create', { ns: 'security-level' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateSecurityLevel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateSecurityLevelPayloadT
    }) => updateSecurityLevelRecord(id, payload),
    onSuccess: () => {
      invalidateSecurityLevelQueries(queryClient)
      toast.success(i18n.t('form.success.update', { ns: 'security-level' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteSecurityLevel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSecurityLevelRecord(id),
    onSuccess: () => {
      invalidateSecurityLevelQueries(queryClient)
      toast.success(i18n.t('delete.success', { ns: 'security-level' }))
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('delete.error', { ns: 'security-level' }),
      )
    },
  })
}

export function useCreateSecurityPermissionDef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      key: string
      name: string
      description?: string
    }) => createSecurityPermissionDef(payload),
    onSuccess: () => {
      invalidatePermissionDefQueries(queryClient)
      toast.success(
        i18n.t('permissions.form.success.create', { ns: 'security-level' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useUpdateSecurityPermissionDef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { name?: string; description?: string; isActive?: boolean }
    }) => updateSecurityPermissionDef(id, payload),
    onSuccess: () => {
      invalidatePermissionDefQueries(queryClient)
      toast.success(
        i18n.t('permissions.form.success.update', { ns: 'security-level' }),
      )
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export function useDeleteSecurityPermissionDef() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSecurityPermissionDef(id),
    onSuccess: () => {
      invalidatePermissionDefQueries(queryClient)
      toast.success(
        i18n.t('permissions.delete.success', { ns: 'security-level' }),
      )
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('permissions.delete.error', { ns: 'security-level' }),
      )
    },
  })
}
