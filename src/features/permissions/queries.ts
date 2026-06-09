import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createAdminRole,
  deleteAdminRole,
  getPermissionRoles,
  getPermissionsCatalog,
  getRolePermissions,
  updateRolePermissions,
} from './api/permissionClient'
import type {
  AdminRoleWritePayloadT,
  PermissionRoleT,
  UpdateRolePermissionsPayloadT,
} from './types'
import { adminRolesQueryKey } from '@/features/user/queries'
import i18n from '@/lib/i18n/config'

export const permissionRolesQueryKey = ['admin', 'permissions', 'roles'] as const
export const permissionsCatalogQueryKey = ['admin', 'permissions', 'catalog'] as const
/** @deprecated use permissionsCatalogQueryKey */
export const systemFunctionsQueryKey = permissionsCatalogQueryKey

export const rolePermissionsQueryKey = (roleId: string) =>
  ['admin', 'permissions', 'roles', roleId] as const

export const permissionRolesQueryOptions = () =>
  queryOptions({
    queryKey: permissionRolesQueryKey,
    queryFn: getPermissionRoles,
    staleTime: 300_000,
  })

export const permissionsCatalogQueryOptions = () =>
  queryOptions({
    queryKey: permissionsCatalogQueryKey,
    queryFn: getPermissionsCatalog,
    staleTime: 300_000,
  })

/** @deprecated use permissionsCatalogQueryOptions */
export const systemFunctionsQueryOptions = permissionsCatalogQueryOptions

export const rolePermissionsQueryOptions = (roleId: string) =>
  queryOptions({
    queryKey: rolePermissionsQueryKey(roleId),
    queryFn: () => getRolePermissions(roleId),
    staleTime: 60_000,
  })

export function useCreateAdminRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AdminRoleWritePayloadT) => createAdminRole(payload),
    onSuccess: () => {
      toast.success(i18n.t('roles.toast.createSuccess', { ns: 'permissions' }))
      void queryClient.invalidateQueries({ queryKey: permissionRolesQueryKey })
      void queryClient.invalidateQueries({ queryKey: adminRolesQueryKey })
    },
    onError: () => {
      toast.error(i18n.t('roles.toast.createFailed', { ns: 'permissions' }))
    },
  })
}

export function useDeleteAdminRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (roleId: string) => deleteAdminRole(roleId),
    onMutate: async (roleId) => {
      await queryClient.cancelQueries({ queryKey: permissionRolesQueryKey })
      await queryClient.cancelQueries({
        queryKey: rolePermissionsQueryKey(roleId),
      })

      const previousRoles = queryClient.getQueryData<Array<PermissionRoleT>>(
        permissionRolesQueryKey,
      )

      queryClient.setQueryData(
        permissionRolesQueryKey,
        (old: Array<PermissionRoleT> | undefined) =>
          old?.filter((role) => role.id !== roleId) ?? old,
      )
      queryClient.removeQueries({ queryKey: rolePermissionsQueryKey(roleId) })

      return { previousRoles }
    },
    onSuccess: () => {
      toast.success(i18n.t('roles.toast.deleteSuccess', { ns: 'permissions' }))
      void queryClient.invalidateQueries({ queryKey: permissionRolesQueryKey })
      void queryClient.invalidateQueries({ queryKey: adminRolesQueryKey })
    },
    onError: (_error, _roleId, context) => {
      if (context?.previousRoles !== undefined) {
        queryClient.setQueryData(
          permissionRolesQueryKey,
          context.previousRoles,
        )
      }
      toast.error(i18n.t('roles.toast.deleteFailed', { ns: 'permissions' }))
    },
  })
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateRolePermissionsPayloadT) =>
      updateRolePermissions(payload),
    onMutate: async (payload) => {
      const queryKey = rolePermissionsQueryKey(payload.roleId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old || typeof old !== 'object') {
          return old
        }

        return {
          ...old,
          rules: {
            permissions: payload.permissions,
            restrictions: payload.restrictions,
          },
        }
      })

      return { previous, roleId: payload.roleId }
    },
    onSuccess: (_data, payload) => {
      toast.success(i18n.t('toast.grantUpdated', { ns: 'permissions' }))
      void queryClient.invalidateQueries({
        queryKey: rolePermissionsQueryKey(payload.roleId),
      })
    },
    onError: (_error, _payload, context) => {
      if (context?.previous !== undefined && context.roleId) {
        queryClient.setQueryData(
          rolePermissionsQueryKey(context.roleId),
          context.previous,
        )
      }
      toast.error(i18n.t('toast.grantFailed', { ns: 'permissions' }))
    },
  })
}
