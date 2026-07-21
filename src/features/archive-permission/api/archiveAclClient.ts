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

export type AclParentWarningT = {
  code: 'missing_fond' | 'missing_dossier_type' | 'missing_document_type'
  message: string
  principalNames: string[]
}

export type ArchiveMetadataViewSlotT = {
  slotCode: string
  sortOrder: number
  principals: Array<ArchiveAclPrincipalT>
  fieldKeys: Array<string>
}

export type ArchiveMetadataViewGroupT = {
  groupCode: string
  groupName: string
  fields: Array<{ key: string; name: string; display: string }>
}

export type ArchiveMetadataViewDocumentTypeT = {
  id: string
  name: string
  hasMetadataConfig: boolean
}

export type ArchiveMetadataViewMatrixT = {
  documentType: { id: string; name: string }
  groups: Array<ArchiveMetadataViewGroupT>
  slots: Array<ArchiveMetadataViewSlotT>
  hasMetadataConfig: boolean
  warnings: Array<AclParentWarningT>
}

export async function fetchArchiveMetadataViewDocumentTypes(): Promise<
  Array<ArchiveMetadataViewDocumentTypeT>
> {
  const response = await apiClient.get<Array<ArchiveMetadataViewDocumentTypeT>>(
    '/api/v1/admin/archive-acl/metadata-view',
  )
  return response.data
}

export async function fetchArchiveMetadataViewMatrix(
  documentTypeId: string,
): Promise<ArchiveMetadataViewMatrixT> {
  const response = await apiClient.get<ArchiveMetadataViewMatrixT>(
    `/api/v1/admin/archive-acl/metadata-view/${encodeURIComponent(documentTypeId)}`,
  )
  return response.data
}

export async function saveArchiveMetadataViewMatrix(
  documentTypeId: string,
  slots: Array<ArchiveMetadataViewSlotT>,
): Promise<ArchiveMetadataViewMatrixT> {
  const response = await apiClient.put<ArchiveMetadataViewMatrixT>(
    `/api/v1/admin/archive-acl/metadata-view/${encodeURIComponent(documentTypeId)}`,
    { slots },
  )
  return response.data
}

export async function assignAllArchiveMetadataView(
  documentTypeId: string,
  slotCode: string,
  principals: Array<ArchiveAclPrincipalT>,
): Promise<ArchiveMetadataViewMatrixT> {
  const response = await apiClient.post<ArchiveMetadataViewMatrixT>(
    `/api/v1/admin/archive-acl/metadata-view/${encodeURIComponent(documentTypeId)}/assign-all`,
    { slotCode, principals },
  )
  return response.data
}
