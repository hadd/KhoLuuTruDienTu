import { z } from 'zod'

import { archiveDossierStatusFilterSchema } from '@/features/archive-submission/schemas'
import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const ARCHIVE_DATA_HUB_TABS = [
  'dossiers',
  'submission',
  'review',
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
  mode: z.enum(['metadata', 'content']).optional().catch(undefined),
  searchFondId: z.string().optional().catch(undefined),
  dossierTypeId: z.string().optional().catch(undefined),
  documentTypeId: z.string().optional().catch(undefined),
  editorName: z.string().optional().catch(undefined),
  editCompletedAtFrom: z.string().optional().catch(undefined),
  editCompletedAtTo: z.string().optional().catch(undefined),
  archivedAtFrom: z.string().optional().catch(undefined),
  archivedAtTo: z.string().optional().catch(undefined),
})

export type ArchiveWarehouseIndexSearchT = z.infer<
  typeof archiveWarehouseIndexSearchSchema
>

export const archiveDataHubSearchSchema = archiveWarehouseIndexSearchSchema.extend({
  tab: z.enum(ARCHIVE_DATA_HUB_TABS).optional().catch('dossiers'),
  status: archiveDossierStatusFilterSchema.optional().catch(undefined),
})

export type ArchiveDataHubSearchT = z.infer<typeof archiveDataHubSearchSchema>

export const warehouseDossierStatusSchema = z.enum(['ARCHIVED'])

/** Search params for fond dossier list page. */
export const archiveWarehouseFondDossiersSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
  mode: z.enum(['metadata', 'content']).optional().catch(undefined),
  dossierName: z.string().optional().catch(undefined),
  documentName: z.string().optional().catch(undefined),
  /** When set to a fond id, scopes metadata search; omit or empty = current route fond. Use "ALL" for ACL-wide. */
  searchFondId: z.string().optional().catch(undefined),
  dossierTypeId: z.string().optional().catch(undefined),
  documentTypeId: z.string().optional().catch(undefined),
  editorName: z.string().optional().catch(undefined),
  editCompletedAtFrom: z.string().optional().catch(undefined),
  editCompletedAtTo: z.string().optional().catch(undefined),
  archivedAtFrom: z.string().optional().catch(undefined),
  archivedAtTo: z.string().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  /** @deprecated Prefer `mode`; kept for old links. */
  contentSearch: z.coerce.boolean().optional().catch(undefined),
  status: warehouseDossierStatusSchema.optional().catch(undefined),
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
