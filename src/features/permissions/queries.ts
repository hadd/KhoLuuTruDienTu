import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getPermissionMatrix,
  getPermissionRoles,
  getSystemFunctions,
  isGrantKeyGranted,
  updatePermissionGrant,
} from './api/permissionClient'
import type { UpdatePermissionGrantPayloadT } from './types'
import i18n from '@/lib/i18n/config'

export const permissionRolesQueryKey = ['admin', 'permissions', 'roles'] as const
export const systemFunctionsQueryKey = ['admin', 'permissions', 'functions'] as const
export const permissionMatrixQueryKey = ['admin', 'permissions', 'matrix'] as const

export const permissionRolesQueryOptions = () =>
  queryOptions({
    queryKey: permissionRolesQueryKey,
    queryFn: getPermissionRoles,
    staleTime: 300_000,
  })

export const systemFunctionsQueryOptions = () =>
  queryOptions({
    queryKey: systemFunctionsQueryKey,
    queryFn: getSystemFunctions,
    staleTime: 300_000,
  })

export const permissionMatrixQueryOptions = () =>
  queryOptions({
    queryKey: permissionMatrixQueryKey,
    queryFn: getPermissionMatrix,
    staleTime: 60_000,
  })

export function useUpdatePermissionGrant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdatePermissionGrantPayloadT) =>
      updatePermissionGrant(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: permissionMatrixQueryKey })

      const previous = queryClient.getQueryData(permissionMatrixQueryKey)

      queryClient.setQueryData(permissionMatrixQueryKey, (old) => {
        const grants = Array.isArray(old) ? [...old] : []
        const { roleId, functionId, granted } = payload

        if (granted) {
          if (!isGrantKeyGranted(grants, roleId, functionId)) {
            grants.push({ roleId, functionId })
          }
        } else {
          return grants.filter(
            (g) => !(g.roleId === roleId && g.functionId === functionId),
          )
        }

        return grants
      })

      return { previous }
    },
    onSuccess: () => {
      toast.success(i18n.t('toast.grantUpdated', { ns: 'permissions' }))
    },
    onError: (_error, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(permissionMatrixQueryKey, context.previous)
      }
      toast.error(i18n.t('toast.grantFailed', { ns: 'permissions' }))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: permissionMatrixQueryKey })
    },
  })
}
