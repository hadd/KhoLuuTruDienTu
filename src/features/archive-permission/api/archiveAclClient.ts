import { apiClient } from '@/lib/api/apiClient'

export type ArchiveAclPrincipalKindT = 'user' | 'role'
export type ArchiveAclResourceKindT =
  | 'fond'
  | 'fond_type'
  | 'dossier_type'
  | 'document_type'

export type ArchiveAclPrincipalT = {
  kind: ArchiveAclPrincipalKindT
  id: string
}

export type ArchiveAclPermissionRowT = {
  permissionKey: string
  entryId: string | null
  principals: Array<ArchiveAclPrincipalT>
}

export type ArchiveAclResourceT = {
  resourceKind: ArchiveAclResourceKindT
  resourceId: string
  name: string
  permissions: Array<ArchiveAclPermissionRowT>
}

export type ArchiveAclMatrixT = {
  permissionKeys: Array<string>
  fondTypes: Array<ArchiveAclResourceT>
  fonds: Array<ArchiveAclResourceT>
  dossierTypes: Array<ArchiveAclResourceT>
  documentTypes: Array<ArchiveAclResourceT>
}
export type ArchiveAclCatalogT = {
  users: Array<{ id: string; name: string; email: string | null }>
  roles: Array<{ id: string; name: string }>
}

export async function fetchArchiveAclMatrix(): Promise<ArchiveAclMatrixT> {
  const response = await apiClient.get<ArchiveAclMatrixT>('/api/v1/admin/archive-acl/matrix')
  return response.data
}

export async function fetchArchiveAclCatalog(): Promise<ArchiveAclCatalogT> {
  const response = await apiClient.get<ArchiveAclCatalogT>('/api/v1/admin/archive-acl/catalog')
  return response.data
}

export async function setArchiveAclPrincipals(body: {
  resourceKind: ArchiveAclResourceKindT
  resourceId: string
  permissionKey: string
  principals: Array<ArchiveAclPrincipalT>
}): Promise<ArchiveAclMatrixT> {
  const response = await apiClient.put<ArchiveAclMatrixT>(
    '/api/v1/admin/archive-acl/principals',
    body,
  )
  return response.data
}

export async function applyAllArchiveAclPermissions(body: {
  resourceKind: ArchiveAclResourceKindT
  resourceId: string
  principals: Array<ArchiveAclPrincipalT>
}): Promise<ArchiveAclMatrixT> {
  const response = await apiClient.post<ArchiveAclMatrixT>(
    '/api/v1/admin/archive-acl/apply-all-permissions',
    body,
  )
  return response.data
}
