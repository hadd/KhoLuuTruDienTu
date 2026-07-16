import { useMemo } from 'react'

import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import {
  canCreateDocumentTypes,
  canDeleteDocumentTypes,
  canUpdateDocumentTypes,
  canViewDocumentTypes,
} from '@/features/document-type/lib/documentTypeAccess'

export function useDocumentTypeAccess() {
  const permissions = useEffectivePermissions()

  return useMemo(
    () => ({
      permissions,
      canViewDocumentTypes: canViewDocumentTypes(permissions),
      canCreateDocumentTypes: canCreateDocumentTypes(permissions),
      canUpdateDocumentTypes: canUpdateDocumentTypes(permissions),
      canDeleteDocumentTypes: canDeleteDocumentTypes(permissions),
    }),
    [permissions],
  )
}
