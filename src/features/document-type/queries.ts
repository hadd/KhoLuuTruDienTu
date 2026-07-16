import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { getDocumentTypes } from '@/features/document-type/api/documentTypeClient'
import type { GetDocumentTypesParamsT } from '@/features/document-type/types'

export const documentTypesQueryKeyPrefix = ['admin', 'document-types'] as const

export const documentTypesQueryKey = (params?: GetDocumentTypesParamsT) =>
  [...documentTypesQueryKeyPrefix, params ?? {}] as const

export const documentTypesQueryOptions = (params?: GetDocumentTypesParamsT) =>
  queryOptions({
    queryKey: documentTypesQueryKey(params),
    queryFn: () => getDocumentTypes(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
