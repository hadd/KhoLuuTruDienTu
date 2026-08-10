import { z } from 'zod'

import { archiveDossierStatusFilterSchema } from '@/features/archive-submission/schemas'
import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const ARCHIVE_DATA_HUB_TABS = [
  'dossiers',
  'expiryReview',
  'disposalProposal',
  'disposalCouncil',
  'submission',
  'review',
  'borrow',
  'reading',
  'borrowReview',
  'config',
  'permission',
] as const

export type ArchiveDataHubTabT = (typeof ARCHIVE_DATA_HUB_TABS)[number]

export function isArchiveDataHubTab(value: string): value is ArchiveDataHubTabT {
  return (ARCHIVE_DATA_HUB_TABS as ReadonlyArray<string>).includes(value)
}

/** Search params for warehouse index (cross-fond search + fond picker). */
export const archiveWarehouseIndexSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  mode: z.enum(['all', 'metadata', 'content']).optional().catch(undefined),
  searchFondId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  dossierTypeId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  documentTypeId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  searchFields: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  editorName: z.string().optional().catch(undefined),
  editCompletedAtFrom: z.string().optional().catch(undefined),
  editCompletedAtTo: z.string().optional().catch(undefined),
  archivedAtFrom: z.string().optional().catch(undefined),
  archivedAtTo: z.string().optional().catch(undefined),
})

export type ArchiveWarehouseIndexSearchT = z.infer<
  typeof archiveWarehouseIndexSearchSchema
>

export const ARCHIVE_WAREHOUSE_BROWSE_VIEWS = [
  'fonds',
  'dossierTypes',
  'documentTypes',
  'unassigned',
] as const

export type ArchiveWarehouseBrowseViewT =
  (typeof ARCHIVE_WAREHOUSE_BROWSE_VIEWS)[number]

/** Sub-views under the consolidated "Hủy hồ sơ" module (`tab=expiryReview`). */
export const ARCHIVE_DISPOSAL_VIEWS = ['list', 'proposal'] as const

export type ArchiveDisposalViewT = (typeof ARCHIVE_DISPOSAL_VIEWS)[number]

export const BROWSE_VIEW_LABEL_KEYS: Record<
  ArchiveWarehouseBrowseViewT,
  | 'page.browseTabFonds'
  | 'page.browseTabDossierTypes'
  | 'page.browseTabDocumentTypes'
  | 'page.browseTabUnassigned'
> = {
  fonds: 'page.browseTabFonds',
  dossierTypes: 'page.browseTabDossierTypes',
  documentTypes: 'page.browseTabDocumentTypes',
  unassigned: 'page.browseTabUnassigned',
}

export const archiveDataHubSearchSchema = archiveWarehouseIndexSearchSchema.extend({
  tab: z.enum(ARCHIVE_DATA_HUB_TABS).optional().catch(undefined),
  browseView: z
    .enum(ARCHIVE_WAREHOUSE_BROWSE_VIEWS)
    .optional()
    .catch(undefined),
  disposalView: z.enum(ARCHIVE_DISPOSAL_VIEWS).optional().catch(undefined),
  status: archiveDossierStatusFilterSchema.optional().catch(undefined),
  disposalCategory: z
    .enum(['all', 'expiring_soon', 'expired', 'duplicate'])
    .optional()
    .catch(undefined),
  disposalEntityKind: z.enum(['dossier', 'document']).optional().catch(undefined),
  disposalCatalogId: z.string().uuid().optional().catch(undefined),
  /** Chỉ set khi bấm "Chọn từ hết hạn/trùng lặp" — mục tiêu thêm vào danh mục soạn thảo. */
  disposalAppendCatalogId: z.string().uuid().optional().catch(undefined),
  disposalCouncilId: z.string().uuid().optional().catch(undefined),
  pickerMode: z.coerce.boolean().optional().catch(undefined),
  disposalInventoryId: z.string().uuid().optional().catch(undefined),
  disposalRetentionPeriodId: z.string().min(1).optional().catch(undefined),
  physicalItemId: z.string().uuid().optional().catch(undefined),
  disposalDateFrom: z.string().optional().catch(undefined),
  disposalDateTo: z.string().optional().catch(undefined),
})

export type ArchiveDataHubSearchT = z.infer<typeof archiveDataHubSearchSchema>

export const warehouseDossierStatusSchema = z.enum(['ARCHIVED'])

/** Search params for fond dossier list page. */
export const archiveWarehouseFondDossiersSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  mode: z.enum(['all', 'metadata', 'content']).optional().catch(undefined),
  dossierName: z.string().optional().catch(undefined),
  documentName: z.string().optional().catch(undefined),
  /** When set to a fond id, scopes metadata search; omit or empty = current route fond. Use "ALL" for ACL-wide. */
  searchFondId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  dossierTypeId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  documentTypeId: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  searchFields: z.union([z.string(), z.array(z.string())]).optional().catch(undefined),
  editorName: z.string().optional().catch(undefined),
  editCompletedAtFrom: z.string().optional().catch(undefined),
  editCompletedAtTo: z.string().optional().catch(undefined),
  archivedAtFrom: z.string().optional().catch(undefined),
  archivedAtTo: z.string().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  /** @deprecated Prefer `mode`; kept for old links. */
  contentSearch: z.coerce.boolean().optional().catch(undefined),
  status: warehouseDossierStatusSchema.optional().catch(undefined),
  pickerMode: z.coerce.boolean().optional().catch(undefined),
  disposalCatalogId: z.string().uuid().optional().catch(undefined),
})

export type ArchiveWarehouseFondDossiersSearchT = z.infer<
  typeof archiveWarehouseFondDossiersSearchSchema
>


/** Search params for dossier detail page. */
export const archiveWarehouseDossierDetailSearchSchema = z.object({
  fileId: z.string().uuid().optional().catch(undefined),
  /** Prefer selecting file by OCR file name from search match. */
  fileName: z.string().optional().catch(undefined),
  highlightPage: z.coerce.number().int().positive().optional().catch(undefined),
  /** Comma-separated bbox: x1,y1,x2,y2 */
  highlightBbox: z.string().optional().catch(undefined),
  /** Active browse tab when entering detail (preserves hub context). */
  browseView: z.enum(ARCHIVE_WAREHOUSE_BROWSE_VIEWS).optional().catch(undefined),
  /** When true, only render the file matching `fileId` (document-type browse). */
  singleFile: z.coerce.boolean().optional().catch(undefined),
  /** Back-navigation context for document-type browse. */
  documentTypeId: z.string().optional().catch(undefined),
  /** Back-navigation context for dossier-type browse. */
  dossierTypeId: z.string().optional().catch(undefined),
})

export type ArchiveWarehouseDossierDetailSearchT = z.infer<
  typeof archiveWarehouseDossierDetailSearchSchema
>

/** @deprecated Keep for any lingering imports; index page has no search. */
export const archiveWarehouseDossiersSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  fondId: z.string().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  status: warehouseDossierStatusSchema.optional().catch(undefined),
  dossierId: z.string().uuid().optional().catch(undefined),
  fileId: z.string().uuid().optional().catch(undefined),
  contentSearch: z.coerce.boolean().optional().catch(undefined),
})

export type ArchiveWarehouseDossiersSearchT = z.infer<
  typeof archiveWarehouseDossiersSearchSchema
>

/** Search params for dossier list by dossier type. */
export const archiveWarehouseDossiersByTypeSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  status: warehouseDossierStatusSchema.optional().catch(undefined),
  pickerMode: z.coerce.boolean().optional().catch(undefined),
  disposalCatalogId: z.string().uuid().optional().catch(undefined),
})

export type ArchiveWarehouseDossiersByTypeSearchT = z.infer<
  typeof archiveWarehouseDossiersByTypeSearchSchema
>

/** Search params for document list by document type. */
export const archiveWarehouseDocumentsByTypeSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  pickerMode: z.coerce.boolean().optional().catch(undefined),
  disposalCatalogId: z.string().uuid().optional().catch(undefined),
})

export type ArchiveWarehouseDocumentsByTypeSearchT = z.infer<
  typeof archiveWarehouseDocumentsByTypeSearchSchema
>
