import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getDocumentNamingConfig,
  getDocumentNamingDossierOptions,
  getDocumentNamingFieldCatalog,
  previewDocumentNamingConfig,
  upsertDocumentNamingConfig,
} from '@/features/document-naming-config/api/documentNamingConfigClient'
import type {
  DocumentNamingPreviewPayloadT,
  DocumentNamingTargetTypeT,
  UpsertDocumentNamingConfigPayloadT,
} from '@/features/document-naming-config/types'

export const documentNamingFieldCatalogQueryKey = [
  'document-naming-config',
  'field-catalog',
] as const

export const documentNamingConfigQueryKeyPrefix = [
  'document-naming-config',
  'config',
] as const

export const documentNamingDossierOptionsQueryKeyPrefix = [
  'document-naming-config',
  'dossier-options',
] as const

export function documentNamingFieldCatalogQueryOptions(
  params?: {
    dossierId?: string
  } | null,
) {
  return queryOptions({
    queryKey: [
      ...documentNamingFieldCatalogQueryKey,
      params?.dossierId ?? null,
    ],
    queryFn: () =>
      getDocumentNamingFieldCatalog(
        params?.dossierId ? { dossierId: params.dossierId } : undefined,
      ),
    staleTime: 60_000,
  })
}

export function documentNamingConfigQueryOptions(
  params: {
    fondId: string
    targetType: DocumentNamingTargetTypeT
    dossierId?: string
  } | null,
) {
  return queryOptions({
    queryKey: [...documentNamingConfigQueryKeyPrefix, params ?? {}],
    queryFn: () => getDocumentNamingConfig(params!),
    enabled: Boolean(params?.fondId),
    staleTime: 0,
  })
}

import { fetchDossierMetadataExportFields } from '@/features/data-management/api/dossierClient'
import { getMetadataTemplates } from '@/features/data-config/api/metadataTemplateClient'
import type { DocumentNamingMetadataFieldOptionT } from '@/features/document-naming-config/types'

export const FALLBACK_TT05_METADATA_FIELDS: Array<DocumentNamingMetadataFieldOptionT> =
  [
    {
      key: 'HO_SO_LUU_TRU.MA_HO_SO',
      groupCode: 'HO_SO_LUU_TRU',
      groupName: 'Metadata cấp Hồ sơ',
      fieldName: 'MA_HO_SO',
      display: 'Mã hồ sơ / Số ĐVBQ',
    },
    {
      key: 'HO_SO_LUU_TRU.MUC_LUC_SO',
      groupCode: 'HO_SO_LUU_TRU',
      groupName: 'Metadata cấp Hồ sơ',
      fieldName: 'MUC_LUC_SO',
      display: 'Mục lục số',
    },
    {
      key: 'HO_SO_LUU_TRU.TIEU_DE_HO_SO',
      groupCode: 'HO_SO_LUU_TRU',
      groupName: 'Metadata cấp Hồ sơ',
      fieldName: 'TIEU_DE_HO_SO',
      display: 'Tiêu đề hồ sơ',
    },
    {
      key: 'HO_SO_LUU_TRU.NAM_HINH_THANH_HO_SO',
      groupCode: 'HO_SO_LUU_TRU',
      groupName: 'Metadata cấp Hồ sơ',
      fieldName: 'NAM_HINH_THANH_HO_SO',
      display: 'Năm hình thành hồ sơ',
    },
    {
      key: 'HO_SO_LUU_TRU.THOI_HAN_LUU_TRU',
      groupCode: 'HO_SO_LUU_TRU',
      groupName: 'Metadata cấp Hồ sơ',
      fieldName: 'THOI_HAN_LUU_TRU',
      display: 'Thời hạn bảo quản',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.SO_THU_TU_VAN_BAN',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'SO_THU_TU_VAN_BAN',
      display: 'Số thứ tự văn bản trong hồ sơ',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'TEN_LOAI_TAI_LIEU',
      display: 'Ký hiệu / Tên loại văn bản',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.SO_CUA_VAN_BAN',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'SO_CUA_VAN_BAN',
      display: 'Số của văn bản',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.KY_HIEU_CUA_VAN_BAN',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'KY_HIEU_CUA_VAN_BAN',
      display: 'Ký hiệu của văn bản',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.NAM',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'NAM',
      display: 'Năm phát hành',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.NGAY_THANG_NAM_BAN_HANH',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'NGAY_THANG_NAM_BAN_HANH',
      display: 'Ngày tháng năm ban hành',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.TEN_CO_QUAN_BAN_HANH',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'TEN_CO_QUAN_BAN_HANH',
      display: 'Tên cơ quan ban hành',
    },
    {
      key: 'TAI_LIEU_LUU_TRU.TRICH_YEU_NOI_DUNG',
      groupCode: 'TAI_LIEU_LUU_TRU',
      groupName: 'Metadata cấp Văn bản',
      fieldName: 'TRICH_YEU_NOI_DUNG',
      display: 'Trích yếu nội dung',
    },
  ]

export type DocumentNamingDossierMetadataQueryResultT = {
  fields: Array<DocumentNamingMetadataFieldOptionT>
  isFallback: boolean
}

export function documentNamingDossierMetadataFieldsQueryOptions(
  dossierId?: string | null,
) {
  return queryOptions<DocumentNamingDossierMetadataQueryResultT>({
    queryKey: ['document-naming-config', 'dossier-metadata-fields', dossierId],
    queryFn: async (): Promise<DocumentNamingDossierMetadataQueryResultT> => {
      if (dossierId) {
        try {
          const fields = await fetchDossierMetadataExportFields(dossierId)
          if (fields && fields.length > 0) {
            return { fields, isFallback: false }
          }
        } catch {
          // Dossier may not have S3 file yet, fall through to templates
        }
      }

      try {
        const templates = await getMetadataTemplates()
        if (templates && templates.length > 0) {
          const allCatalog = templates.flatMap((t) => t.fieldCatalog ?? [])
          const seen = new Set<string>()
          const catalog: Array<DocumentNamingMetadataFieldOptionT> = []
          for (const item of allCatalog) {
            if (!seen.has(item.key)) {
              seen.add(item.key)
              catalog.push({
                key: item.key,
                groupCode: item.groupCode,
                groupName: item.groupName,
                fieldName: item.fieldName,
                display: item.display,
              })
            }
          }
          if (catalog.length > 0) {
            return { fields: catalog, isFallback: Boolean(dossierId) }
          }
        }
      } catch {
        // Fallback to static TT05
      }

      return {
        fields: FALLBACK_TT05_METADATA_FIELDS,
        isFallback: Boolean(dossierId),
      }
    },
    staleTime: 60_000,
  })
}

export function documentNamingDossierOptionsQueryOptions(
  params: {
    fondId: string
    search?: string
  } | null,
) {
  return queryOptions({
    queryKey: [...documentNamingDossierOptionsQueryKeyPrefix, params ?? {}],
    queryFn: () => getDocumentNamingDossierOptions({ ...params!, limit: 50 }),
    enabled: Boolean(params?.fondId),
    staleTime: 30_000,
  })
}

export function useUpsertDocumentNamingConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpsertDocumentNamingConfigPayloadT) =>
      upsertDocumentNamingConfig(payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: documentNamingConfigQueryKeyPrefix,
      })
      void queryClient.invalidateQueries({
        queryKey: [
          ...documentNamingConfigQueryKeyPrefix,
          {
            fondId: variables.fondId,
            targetType: variables.targetType,
            dossierId: variables.dossierId ?? undefined,
          },
        ],
      })
    },
  })
}

export function usePreviewDocumentNamingConfig() {
  return useMutation({
    mutationFn: (payload: DocumentNamingPreviewPayloadT) =>
      previewDocumentNamingConfig(payload),
  })
}
