import type {
  AclParentWarningT,
  ArchiveAclMatrixT,
  ArchiveAclPrincipalT,
  ArchiveAclResourceT,
  ArchiveMetadataViewSlotT,
} from '@/features/archive-permission/api/archiveAclClient'

function principalKey(p: ArchiveAclPrincipalT): string {
  return `${p.kind}:${p.id}`
}

type GrantIndex = {
  fondPrincipalKeys: Set<string>
  fondTypePrincipalKeys: Set<string>
  documentTypeReadPrincipalKeys: Map<string, Set<string>>
}

function buildGrantIndex(matrix: ArchiveAclMatrixT): GrantIndex {
  const fondPrincipalKeys = new Set<string>()
  const fondTypePrincipalKeys = new Set<string>()
  const documentTypeReadPrincipalKeys = new Map<string, Set<string>>()

  const allResources: Array<ArchiveAclResourceT> = [
    ...matrix.fondTypes,
    ...matrix.fonds,
    ...matrix.dossierTypes,
    ...matrix.documentTypes,
  ]

  for (const resource of allResources) {
    for (const perm of resource.permissions) {
      const isRead =
        perm.permissionKey === 'archive.warehouse.read' ||
        perm.permissionKey === 'archive.warehouse.search'
      for (const p of perm.principals) {
        const key = principalKey(p)
        if (resource.resourceKind === 'fond') fondPrincipalKeys.add(key)
        if (resource.resourceKind === 'fond_type') fondTypePrincipalKeys.add(key)
        if (resource.resourceKind === 'document_type' && isRead) {
          const set =
            documentTypeReadPrincipalKeys.get(resource.resourceId) ?? new Set()
          set.add(key)
          documentTypeReadPrincipalKeys.set(resource.resourceId, set)
        }
      }
    }
  }

  return { fondPrincipalKeys, fondTypePrincipalKeys, documentTypeReadPrincipalKeys }
}

function hasFondAccess(index: GrantIndex, key: string): boolean {
  return index.fondPrincipalKeys.has(key) || index.fondTypePrincipalKeys.has(key)
}

function namesFromPrincipals(
  principals: Array<ArchiveAclPrincipalT>,
  nameByKey: Map<string, string>,
): string[] {
  return principals.map((p) => nameByKey.get(principalKey(p)) ?? p.id)
}

export function warnDossierTypeMissingFond(
  principals: Array<ArchiveAclPrincipalT>,
  matrix: ArchiveAclMatrixT,
  nameByKey: Map<string, string>,
): AclParentWarningT | null {
  const index = buildGrantIndex(matrix)
  const missing = principals.filter(
    (p) => !hasFondAccess(index, principalKey(p)),
  )
  if (missing.length === 0) return null
  return {
    code: 'missing_fond',
    message:
      'Người dùng / vai trò sau chưa được gán phông. Quyền loại hồ sơ chưa có hiệu lực.',
    principalNames: namesFromPrincipals(missing, nameByKey),
  }
}

export function warnDocumentTypeMissingFond(
  principals: Array<ArchiveAclPrincipalT>,
  matrix: ArchiveAclMatrixT,
  nameByKey: Map<string, string>,
): AclParentWarningT | null {
  const index = buildGrantIndex(matrix)
  const missing = principals.filter(
    (p) => !hasFondAccess(index, principalKey(p)),
  )
  if (missing.length === 0) return null
  return {
    code: 'missing_fond',
    message:
      'Người dùng / vai trò sau chưa được gán phông. Quyền loại tài liệu chưa có hiệu lực.',
    principalNames: namesFromPrincipals(missing, nameByKey),
  }
}

export function warnMetadataMissingDocumentTypeRead(
  principals: Array<ArchiveAclPrincipalT>,
  documentTypeId: string,
  matrix: ArchiveAclMatrixT,
  nameByKey: Map<string, string>,
): AclParentWarningT | null {
  const index = buildGrantIndex(matrix)
  const readKeys =
    index.documentTypeReadPrincipalKeys.get(documentTypeId) ?? new Set()
  const missing = principals.filter(
    (p) => !readKeys.has(principalKey(p)),
  )
  if (missing.length === 0) return null
  return {
    code: 'missing_document_type',
    message:
      'Chưa gán quyền xem loại tài liệu ở tab Tài liệu. Phân quyền trường chưa có hiệu lực.',
    principalNames: namesFromPrincipals(missing, nameByKey),
  }
}

export function collectMetadataWarnings(
  documentTypeId: string,
  slots: Array<ArchiveMetadataViewSlotT>,
  matrix: ArchiveAclMatrixT,
  nameByKey: Map<string, string>,
): Array<AclParentWarningT> {
  const principals = slots.flatMap((s) => s.principals)
  const w = warnMetadataMissingDocumentTypeRead(
    principals,
    documentTypeId,
    matrix,
    nameByKey,
  )
  return w ? [w] : []
}

export function collectResourceWarnings(
  resource: ArchiveAclResourceT,
  matrix: ArchiveAclMatrixT,
  nameByKey: Map<string, string>,
): Array<AclParentWarningT> {
  const principals = resource.permissions.flatMap((p) => p.principals)
  if (principals.length === 0) return []

  if (resource.resourceKind === 'dossier_type') {
    const w = warnDossierTypeMissingFond(principals, matrix, nameByKey)
    return w ? [w] : []
  }
  if (resource.resourceKind === 'document_type') {
    const w = warnDocumentTypeMissingFond(principals, matrix, nameByKey)
    return w ? [w] : []
  }
  return []
}
