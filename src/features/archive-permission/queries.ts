import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  applyAllArchiveAclPermissions,
  fetchArchiveAclCatalog,
  fetchArchiveAclMatrix,
  setArchiveAclPrincipals,
  type ArchiveAclPrincipalT,
  type ArchiveAclResourceKindT,
} from '@/features/archive-permission/api/archiveAclClient'
import { getActiveArchiveFonds } from '@/features/archive-fond/api/archiveFondClient'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const activeArchiveFondsQueryKey = [
  'archive',
  'fonds',
  'active',
] as const

export const archiveAclMatrixQueryKey = ['admin', 'archive-acl', 'matrix'] as const
export const archiveAclCatalogQueryKey = ['admin', 'archive-acl', 'catalog'] as const

export const activeArchiveFondsQueryOptions = () =>
  queryOptions({
    queryKey: activeArchiveFondsQueryKey,
    queryFn: getActiveArchiveFonds,
    staleTime: 60_000,
  })

export const archiveAclMatrixQueryOptions = () =>
  queryOptions({
    queryKey: archiveAclMatrixQueryKey,
    queryFn: fetchArchiveAclMatrix,
    staleTime: 30_000,
  })

export const archiveAclCatalogQueryOptions = () =>
  queryOptions({
    queryKey: archiveAclCatalogQueryKey,
    queryFn: fetchArchiveAclCatalog,
    staleTime: 60_000,
  })

export const useSetArchiveAclPrincipals = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: {
      resourceKind: ArchiveAclResourceKindT
      resourceId: string
      permissionKey: string
      principals: Array<ArchiveAclPrincipalT>
    }) => setArchiveAclPrincipals(body),
    onSuccess: (data) => {
      queryClient.setQueryData(archiveAclMatrixQueryKey, data)
      toast.success(i18n.t('acl.toastSaved', { ns: 'archive-permission' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}

export const useApplyAllArchiveAclPermissions = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: {
      resourceKind: ArchiveAclResourceKindT
      resourceId: string
      principals: Array<ArchiveAclPrincipalT>
    }) => applyAllArchiveAclPermissions(body),
    onSuccess: (data) => {
      queryClient.setQueryData(archiveAclMatrixQueryKey, data)
      toast.success(i18n.t('acl.toastApplyAll', { ns: 'archive-permission' }))
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })
}
