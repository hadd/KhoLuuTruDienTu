import { httpError } from "@shared/common-lib"
import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm"
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts"
import { db } from "../../db/db-conn.ts"
import { archiveSubmissions } from "../../db/schemas/archive-submission.ts"
import type { ArchiveFieldConfigSnapshot, ArchiveFieldValueSnapshot } from "../../db/schemas/archive-submission.ts"
import { ArchiveSubmissionStatus } from "../../db/schemas/archive-constants.ts"
import { dossierFiles } from "../../db/schemas/dossier-file.ts"
import { dossiers } from "../../db/schemas/dossier.ts"
import { dossierPhysicalPlacements } from "../../db/schemas/dossier-physical-placement.ts"
import { DossierPhysicalPlacementStatus } from "../../db/schemas/dossier-physical-placement-constants.ts"
import { fonds } from "../../db/schemas/fond.ts"
import { inventories } from "../../db/schemas/inventory.ts"
import { DossierStatus } from "../../db/schemas/workflow-constants.ts"
import { type ArchiveDataScope, ArchiveScopeResolver } from "../archive-permission/archive-scope-resolver.ts"
import { resolveMetadataViewAccessForDocumentTypes } from "../archive-permission/archive-metadata-field-scope.ts"
import { Permission } from "../auth/permission-catalog.ts"
import { userRolesHavePermission } from "../auth/permission-resolver.ts"
import { ARCHIVE_WAREHOUSE_ACTION_PERMISSIONS, hasArchiveWarehousePermission } from "./archive-warehouse-permissions.ts"
import { resolveDossierEffectiveRetention } from "../../libs/retention-dossier.ts"
import { formatEffectiveRetentionDisplay } from "../../libs/retention-compare.ts"
import { metadataTemplates } from "../../db/schemas/metadata_template.ts"
import { parseFieldCatalog } from "../../libs/metadata-template.ts"

export type WarehouseFondActions = {
  edit: boolean
  delete: boolean
  reupload: boolean
  download: boolean
}

/**
 * Quyền thao tác trên một phông: Function Matrix + ACL phông (hoặc search.global).
 * Dùng để FE ẩn/hiện nút di chuyển / xóa / upload lại.
 */
export async function resolveWarehouseFondActions(
  profile: UserWithRoles,
  fondId: string | null | undefined,
): Promise<WarehouseFondActions> {
  const actions: WarehouseFondActions = {
    edit: false,
    delete: false,
    reupload: false,
    download: false,
  }
  const trimmed = fondId?.trim()
  if (!trimmed) return actions

  const isGlobal = userRolesHavePermission(
    profile.userRoles,
    Permission.SEARCH_GLOBAL,
  )

  await Promise.all(
    ARCHIVE_WAREHOUSE_ACTION_PERMISSIONS.map(async (permissionKey) => {
      if (!hasArchiveWarehousePermission(profile, permissionKey)) return

      let allowed = isGlobal
      if (!allowed) {
        const scope = await ArchiveScopeResolver.resolve(profile, {
          warehousePermission: permissionKey,
        })
        allowed = scope.mode === "global" ||
          ((scope.mode === "scoped" || scope.mode === "fond") &&
            scope.fondIds.includes(trimmed))
      }

      if (!allowed) return
      if (permissionKey === Permission.ARCHIVE_WAREHOUSE_EDIT) {
        actions.edit = true
      } else if (permissionKey === Permission.ARCHIVE_WAREHOUSE_DELETE) {
        actions.delete = true
      } else if (permissionKey === Permission.ARCHIVE_WAREHOUSE_REUPLOAD) {
        actions.reupload = true
      }
    }),
  )

  return actions
}
import { activeDossierWhere } from "../dossier/active-query-filters.ts"
import { getRawStoragePrefix, normalizeStorageKey, storageBasename, toSearchablePdfKey } from "../dossier/dossier-path-utils.ts"
import { isProtectedArchivalKey } from "../dossier/dossier-delete-utils.ts"
import { DossierService } from "../dossier/dossier-service.ts"
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts"
import { assertActiveSecurityLevelId, getEffectiveBool } from "../security-level/security-clearance.ts"
import {
  assertSecurityResourceAccess,
  type SecurityAccessHeaders,
} from "../security-level/security-enforcement.ts"
import { FlagRuleKey, PermissionRuleKey, permissionRuleKey } from "../security-level/security-rule-keys.ts"
import { securityLevels } from "../../db/schemas/security-level.ts"
import { statStorageObject } from "../scan-intake/scan-intake-s3-utils.ts"
import { searchDocuments, searchMetadataDocuments, searchUnifiedDocuments } from "@shared/search-engine"
import { DOSSIER_ENTITY_TYPE, indexDossierById } from "../search/adapters/dossier.adapter.ts"
import { enqueueDossierDelete } from "../search/search-index-queue.ts"
import { dossierTypes } from "../../db/schemas/dossier-type.ts"
import { documentTypes } from "../../db/schemas/document-type.ts"
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts"
import { executeWarehouseFileMove } from "./archive-warehouse-move.ts"
import { reopenDossierForOcr, resolveWorkingFilePath } from "./archive-warehouse-reopen.ts"
import {
  copyStorageObject,
  deleteStorageObjectQuiet,
  setCopyStorageObjectOverrideForTests,
  setDeleteStorageObjectOverrideForTests,
  setStatStorageObjectOverrideForTests,
  setStorageObjectExistsOverrideForTests,
} from "./archive-warehouse-storage.ts"

export {
  setCopyStorageObjectOverrideForTests,
  setDeleteStorageObjectOverrideForTests,
  setStatStorageObjectOverrideForTests,
  setStorageObjectExistsOverrideForTests,
}

export const WAREHOUSE_DOSSIER_STATUSES = [DossierStatus.ARCHIVED] as const
export type WarehouseDossierStatus = (typeof WAREHOUSE_DOSSIER_STATUSES)[number]

export type BrowseArchiveWarehouseQuery = {
  page?: number
  limit?: number
  fondId?: string
  search?: string
  year?: number
  status?: WarehouseDossierStatus
}

export type BrowseArchiveWarehouseByDossierTypeQuery = {
  page?: number
  limit?: number
  dossierTypeId?: string
  search?: string
  year?: number
  status?: WarehouseDossierStatus
}

export type BrowseArchiveWarehouseByDocumentTypeQuery = {
  page?: number
  limit?: number
  documentTypeId?: string
  search?: string
}

type LatestSubmissionRow = {
  dossierId: string
  reviewedAt: Date | null
  fieldValues: ArchiveFieldValueSnapshot
  fieldConfigSnapshot: ArchiveFieldConfigSnapshot
  archiveYear: number | null
}

export async function resolveWarehouseScope(profile: UserWithRoles) {
  const candidates = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_SEARCH,
    Permission.ARCHIVE_WAREHOUSE_EDIT,
    Permission.ARCHIVE_WAREHOUSE_DELETE,
    Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
  ] as const
  const warehousePermission = candidates.find((key) => hasArchiveWarehousePermission(profile, key)) ?? Permission.ARCHIVE_WAREHOUSE_READ

  // List/browse: union mọi ACL resource user có capability — vẫn scoped theo phông được gán,
  // không bypass global (chỉ search.global mới toàn kho).
  const scope = await ArchiveScopeResolver.resolve(profile, {
    warehousePermission,
    includeAllCapableResources: true,
  })
  return {
    scope,
    fondScope: scope.mode === "global" ? null : scope.mode === "scoped" || scope.mode === "fond" ? scope.fondIds : [],
  }
}

export function assertFondAccess(
  scope: ArchiveDataScope,
  fondId?: string,
): string {
  const trimmed = fondId?.trim()
  if (!trimmed) {
    throw httpError.badRequest("fondId là bắt buộc")
  }
  if (scope.mode === "none") {
    throw httpError.forbidden("Bạn không có quyền truy cập phông này")
  }
  if (scope.mode === "global") {
    return trimmed
  }
  if (
    (scope.mode === "scoped" || scope.mode === "fond") &&
    !scope.fondIds.includes(trimmed)
  ) {
    throw httpError.forbidden("Bạn không có quyền truy cập phông này")
  }
  return trimmed
}

export function assertWarehouseDossierAccess(
  scope: ArchiveDataScope,
  dossier: { fondId: string | null | undefined; dossierTypeId?: string | null },
): void {
  if (scope.mode === "none") {
    throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ này trong kho")
  }
  const trimmedFondId = dossier.fondId?.trim()
  if (trimmedFondId) {
    assertFondAccess(scope, trimmedFondId)
  }
  assertDossierTypeAccess(scope, dossier.dossierTypeId)
}

function assertUnassignedWarehouseAccess(scope: ArchiveDataScope): void {
  if (scope.mode === "none") {
    throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ chưa thuộc phông")
  }
}

function assertDossierTypeAccess(
  scope: ArchiveDataScope,
  dossierTypeId: string | null | undefined,
): void {
  if (scope.mode !== "scoped") return
  // Chưa gán loại hồ sơ trên ACL → không lọc theo trục này.
  if (scope.dossierTypeIds.length === 0) return
  if (!dossierTypeId || !scope.dossierTypeIds.includes(dossierTypeId)) {
    throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này")
  }
}

/** Hồ sơ có ít nhất một file thuộc một trong các loại tài liệu được gán. */
function documentTypeScopeCondition(documentTypeIds: string[]): SQL {
  return sql`exists (
        select 1
        from ${dossierFiles} f
        where f.dossier_id = ${dossiers.id}
          and f.document_type_id in (${
    sql.join(
      documentTypeIds.map((id) => sql`${id}`),
      sql`, `,
    )
  })
    )`
}

function assertDocumentTypeFilterAccess(
  scope: ArchiveDataScope,
  documentTypeId: string | null | undefined,
): void {
  if (!documentTypeId?.trim()) return
  if (scope.mode !== "scoped") return
  if (scope.documentTypeIds.length === 0) return
  if (!scope.documentTypeIds.includes(documentTypeId.trim())) {
    throw httpError.forbidden("Bạn không có quyền truy cập loại tài liệu này trong kho")
  }
}

/** Cột dossier_type_id HOẶC field_values->>'dossier_type' của đơn APPROVED (data cũ chưa denormalize). */
function dossierTypeScopeCondition(dossierTypeIds: string[]): SQL {
  const typeIdList = sql.join(
    dossierTypeIds.map((id) => sql`${id}`),
    sql`, `,
  )
  return or(
    inArray(dossiers.dossierTypeId, dossierTypeIds),
    sql`exists (
            select 1
            from ${archiveSubmissions} s
            where s.dossier_id = ${dossiers.id}
              and s.status = ${ArchiveSubmissionStatus.APPROVED}
              and (s.field_values->>'dossier_type') in (${typeIdList})
        )`,
  )!
}

function resolveDossierTypeIdFromFieldValues(
  fieldValues: ArchiveFieldValueSnapshot | null | undefined,
): string | null {
  const value = fieldValues?.dossier_type
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function resolveWarehouseStatus(status?: string): WarehouseDossierStatus {
  const value = status?.trim() || DossierStatus.ARCHIVED
  if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(value)) {
    throw httpError.badRequest(`Trạng thái hồ sơ không hợp lệ: ${value}`)
  }
  return value as WarehouseDossierStatus
}

/**
 * Đối chiếu hit từ ES với DB: chỉ giữ hồ sơ còn ARCHIVED, chưa xóa mềm.
 * Doc rác (ES chưa xóa kịp) bị lọc và enqueue xóa lại.
 */
async function filterDossierHitsAgainstDb<T extends { entityId: string }>(
  hits: T[],
): Promise<{ hits: T[]; staleCount: number; deniedCount: number }> {
  if (hits.length === 0) {
    return { hits, staleCount: 0, deniedCount: 0 }
  }

  const ids = [...new Set(hits.map((hit) => hit.entityId))]
  const archivedWhere = activeDossierWhere(
    inArray(dossiers.id, ids),
    eq(dossiers.status, DossierStatus.ARCHIVED),
  )

  const archivedRows = await db
    .select({ id: dossiers.id })
    .from(dossiers)
    .where(archivedWhere)

  const validIds = new Set(archivedRows.map((row) => row.id))

  const staleIds = ids.filter((id) => !validIds.has(id))
  for (const staleId of staleIds) {
    enqueueDossierDelete(staleId)
  }

  return {
    hits: hits.filter((hit) => validIds.has(hit.entityId)),
    staleCount: staleIds.length,
    deniedCount: 0,
  }
}

function yearFilterCondition(year: number): SQL {
  return sql`exists (
        select 1
        from ${archiveSubmissions} s
        inner join ${inventories} i on i.id = (s.field_values->>'inventory')
        where s.dossier_id = ${dossiers.id}
          and s.status = ${ArchiveSubmissionStatus.APPROVED}
          and i.submission_year = ${year}
    )`
}

async function loadLatestApprovedSubmissions(
  dossierIds: string[],
): Promise<Map<string, LatestSubmissionRow>> {
  if (dossierIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .selectDistinctOn([archiveSubmissions.dossierId], {
      dossierId: archiveSubmissions.dossierId,
      reviewedAt: archiveSubmissions.reviewedAt,
      fieldValues: archiveSubmissions.fieldValues,
      fieldConfigSnapshot: archiveSubmissions.fieldConfigSnapshot,
      inventoryId: sql<string | null>`${archiveSubmissions.fieldValues}->>'inventory'`,
    })
    .from(archiveSubmissions)
    .where(and(
      inArray(archiveSubmissions.dossierId, dossierIds),
      eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
    ))
    .orderBy(archiveSubmissions.dossierId, desc(archiveSubmissions.reviewedAt))

  const inventoryIds = [
    ...new Set(
      rows
        .map((row) => row.inventoryId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const yearByInventoryId = new Map<string, number>()
  if (inventoryIds.length > 0) {
    const inventoryRows = await db
      .select({
        id: inventories.id,
        submissionYear: inventories.submissionYear,
      })
      .from(inventories)
      .where(inArray(inventories.id, inventoryIds))

    for (const row of inventoryRows) {
      yearByInventoryId.set(row.id, row.submissionYear)
    }
  }

  const result = new Map<string, LatestSubmissionRow>()
  for (const row of rows) {
    const inventoryId = row.inventoryId?.trim()
    result.set(row.dossierId, {
      dossierId: row.dossierId,
      reviewedAt: row.reviewedAt,
      fieldValues: row.fieldValues,
      fieldConfigSnapshot: row.fieldConfigSnapshot,
      archiveYear: inventoryId ? yearByInventoryId.get(inventoryId) ?? null : null,
    })
  }
  return result
}

async function loadDocumentStatsByDossierIds(dossierIds: string[]) {
  if (dossierIds.length === 0) {
    return new Map<string, { documentCount: number; totalSizeKb: number }>()
  }

  const rows = await db
    .select({
      dossierId: dossierFiles.dossierId,
      documentCount: sql<number>`count(*)::int`.mapWith(Number),
      totalSizeKb: sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
    })
    .from(dossierFiles)
    .where(inArray(dossierFiles.dossierId, dossierIds))
    .groupBy(dossierFiles.dossierId)

  return new Map(
    rows.map((row) => [
      row.dossierId,
      { documentCount: row.documentCount, totalSizeKb: row.totalSizeKb },
    ]),
  )
}

async function loadActivePhysicalPlacements(
  dossierIds: string[],
): Promise<Map<string, string | null>> {
  if (dossierIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      dossierId: dossierPhysicalPlacements.dossierId,
      boxName: physicalWarehouseItems.name,
    })
    .from(dossierPhysicalPlacements)
    .leftJoin(
      physicalWarehouseItems,
      eq(physicalWarehouseItems.id, dossierPhysicalPlacements.physicalItemId),
    )
    .where(
      and(
        inArray(dossierPhysicalPlacements.dossierId, dossierIds),
        eq(
          dossierPhysicalPlacements.status,
          DossierPhysicalPlacementStatus.ACTIVE,
        ),
      ),
    )

  return new Map(rows.map((row) => [row.dossierId, row.boxName ?? null]))
}

function buildArchivedDossierWhere(
  fondId: string,
  status: WarehouseDossierStatus,
  search?: string,
  year?: number,
  dossierTypeIds?: string[],
  documentTypeIds?: string[],
) {
  const searchTerm = search?.trim()
  const searchCondition = searchTerm
    ? or(
      ilike(dossiers.name, `%${searchTerm}%`),
      ilike(dossiers.folderPath, `%${searchTerm}%`),
    )
    : undefined

  return activeDossierWhere(
    eq(dossiers.fondId, fondId),
    eq(dossiers.status, status),
    ...(dossierTypeIds && dossierTypeIds.length > 0 ? [dossierTypeScopeCondition(dossierTypeIds)] : []),
    ...(documentTypeIds && documentTypeIds.length > 0 ? [documentTypeScopeCondition(documentTypeIds)] : []),
    ...(year != null ? [yearFilterCondition(year)] : []),
    ...(searchCondition ? [searchCondition] : []),
  )
}

function buildUnassignedArchivedDossierWhere(
  status: WarehouseDossierStatus,
  search?: string,
  dossierTypeIds?: string[],
  documentTypeIds?: string[],
) {
  const searchTerm = search?.trim()
  const searchCondition = searchTerm
    ? or(
      ilike(dossiers.name, `%${searchTerm}%`),
      ilike(dossiers.folderPath, `%${searchTerm}%`),
    )
    : undefined

  return activeDossierWhere(
    isNull(dossiers.fondId),
    eq(dossiers.status, status),
    ...(dossierTypeIds && dossierTypeIds.length > 0 ? [dossierTypeScopeCondition(dossierTypeIds)] : []),
    ...(documentTypeIds && documentTypeIds.length > 0 ? [documentTypeScopeCondition(documentTypeIds)] : []),
    ...(searchCondition ? [searchCondition] : []),
  )
}

function fondScopeDossierCondition(fondIds: string[]): SQL {
  return inArray(dossiers.fondId, fondIds)
}

function resolveScopedFondIds(scope: ArchiveDataScope): string[] | undefined {
  if (scope.mode === "global") return undefined
  if (scope.mode === "scoped" || scope.mode === "fond") return scope.fondIds
  return []
}

function buildArchivedDossierWhereByDossierType(
  dossierTypeId: string,
  status: WarehouseDossierStatus,
  search?: string,
  year?: number,
  fondIds?: string[],
  documentTypeIds?: string[],
) {
  const searchTerm = search?.trim()
  const searchCondition = searchTerm
    ? or(
      ilike(dossiers.name, `%${searchTerm}%`),
      ilike(dossiers.folderPath, `%${searchTerm}%`),
    )
    : undefined

  return activeDossierWhere(
    eq(dossiers.status, status),
    dossierTypeScopeCondition([dossierTypeId]),
    ...(fondIds && fondIds.length > 0 ? [fondScopeDossierCondition(fondIds)] : []),
    ...(documentTypeIds && documentTypeIds.length > 0 ? [documentTypeScopeCondition(documentTypeIds)] : []),
    ...(year != null ? [yearFilterCondition(year)] : []),
    ...(searchCondition ? [searchCondition] : []),
  )
}

function buildWarehouseDocumentsWhereByDocumentType(
  documentTypeId: string,
  search?: string,
  fondIds?: string[],
  dossierTypeIds?: string[],
) {
  const searchTerm = search?.trim()
  const searchCondition = searchTerm
    ? or(
      ilike(dossierFiles.fileName, `%${searchTerm}%`),
      ilike(dossiers.name, `%${searchTerm}%`),
    )
    : undefined

  return and(
    eq(dossierFiles.documentTypeId, documentTypeId),
    activeDossierWhere(
      eq(dossiers.status, DossierStatus.ARCHIVED),
      ...(fondIds && fondIds.length > 0 ? [fondScopeDossierCondition(fondIds)] : []),
      ...(dossierTypeIds && dossierTypeIds.length > 0 ? [dossierTypeScopeCondition(dossierTypeIds)] : []),
    ),
    ...(searchCondition ? [searchCondition] : []),
  )
}

async function loadAvailableYears(
  fondId: string,
  status: WarehouseDossierStatus,
) {
  const whereClause = activeDossierWhere(
    eq(dossiers.fondId, fondId),
    eq(dossiers.status, status),
  )

  const rows = await db
    .selectDistinct({
      submissionYear: inventories.submissionYear,
    })
    .from(dossiers)
    .innerJoin(
      archiveSubmissions,
      and(
        eq(archiveSubmissions.dossierId, dossiers.id),
        eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
      ),
    )
    .innerJoin(
      inventories,
      sql`${inventories.id} = (${archiveSubmissions.fieldValues}->>'inventory')`,
    )
    .where(whereClause)
    .orderBy(desc(inventories.submissionYear))

  return rows
    .map((row) => row.submissionYear)
    .filter((year): year is number => year != null)
}

async function loadAvailableYearsByDossierType(
  dossierTypeId: string,
  status: WarehouseDossierStatus,
  fondIds?: string[],
) {
  const whereClause = buildArchivedDossierWhereByDossierType(
    dossierTypeId,
    status,
    undefined,
    undefined,
    fondIds,
    undefined,
  )

  const rows = await db
    .selectDistinct({
      submissionYear: inventories.submissionYear,
    })
    .from(dossiers)
    .innerJoin(
      archiveSubmissions,
      and(
        eq(archiveSubmissions.dossierId, dossiers.id),
        eq(archiveSubmissions.status, ArchiveSubmissionStatus.APPROVED),
      ),
    )
    .innerJoin(
      inventories,
      sql`${inventories.id} = (${archiveSubmissions.fieldValues}->>'inventory')`,
    )
    .where(whereClause)
    .orderBy(desc(inventories.submissionYear))

  return rows
    .map((row) => row.submissionYear)
    .filter((year): year is number => year != null)
}

function buildWarehouseListScopeWhere(scope: ArchiveDataScope): SQL | null {
  if (scope.mode === "none") return null

  const conditions: SQL[] = [eq(dossiers.status, DossierStatus.ARCHIVED)]

  if (scope.mode === "scoped" || scope.mode === "fond") {
    if (scope.fondIds.length === 0) return null
    conditions.push(inArray(dossiers.fondId, scope.fondIds))
  }
  if (scope.mode === "scoped" && scope.dossierTypeIds.length > 0) {
    conditions.push(dossierTypeScopeCondition(scope.dossierTypeIds))
  }
  if (scope.mode === "scoped" && scope.documentTypeIds.length > 0) {
    conditions.push(documentTypeScopeCondition(scope.documentTypeIds))
  }

  return activeDossierWhere(...conditions)
}

async function loadArchivedDossierCountsByFond(
  scope: ArchiveDataScope,
): Promise<Map<string, number>> {
  const scopeWhere = buildWarehouseListScopeWhere(scope)
  const map = new Map<string, number>()
  if (!scopeWhere) return map

  const rows = await db
    .select({
      fondId: dossiers.fondId,
      dossierCount: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(dossiers)
    .where(and(scopeWhere, sql`${dossiers.fondId} is not null`))
    .groupBy(dossiers.fondId)

  for (const row of rows) {
    if (row.fondId) map.set(row.fondId, row.dossierCount)
  }
  return map
}

async function loadArchivedDossierCountForType(
  scope: ArchiveDataScope,
  dossierTypeId: string,
): Promise<number> {
  const fondIds = resolveScopedFondIds(scope)
  if (fondIds && fondIds.length === 0) return 0

  const whereClause = buildArchivedDossierWhereByDossierType(
    dossierTypeId,
    DossierStatus.ARCHIVED,
    undefined,
    undefined,
    fondIds,
    scope.mode === "scoped" && scope.documentTypeIds.length > 0
      ? scope.documentTypeIds
      : undefined,
  )

  const [row] = await db
    .select({ count: count() })
    .from(dossiers)
    .where(whereClause)

  return row?.count ?? 0
}

async function loadArchivedDocumentCountsByDocumentType(
  scope: ArchiveDataScope,
  documentTypeIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (documentTypeIds.length === 0) return map

  const fondIds = resolveScopedFondIds(scope)
  if (fondIds && fondIds.length === 0) return map

  const baseDossierWhere = activeDossierWhere(
    eq(dossiers.status, DossierStatus.ARCHIVED),
    ...(fondIds && fondIds.length > 0 ? [fondScopeDossierCondition(fondIds)] : []),
    ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0
      ? [dossierTypeScopeCondition(scope.dossierTypeIds)]
      : []),
  )

  const rows = await db
    .select({
      documentTypeId: dossierFiles.documentTypeId,
      documentCount: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(dossierFiles)
    .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
    .where(and(
      inArray(dossierFiles.documentTypeId, documentTypeIds),
      baseDossierWhere,
    ))
    .groupBy(dossierFiles.documentTypeId)

  for (const row of rows) {
    if (row.documentTypeId) map.set(row.documentTypeId, row.documentCount)
  }
  return map
}

export const ArchiveWarehouseService = {
  async listFonds(profile: UserWithRoles) {
    const { scope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      return { items: [] as Array<typeof fonds.$inferSelect> }
    }

    const conditions = [
      eq(fonds.isActive, true),
      isNull(fonds.deletedAt),
    ]
    if (scope.mode === "scoped" || scope.mode === "fond") {
      if (scope.fondIds.length === 0) {
        return { items: [] as Array<typeof fonds.$inferSelect> }
      }
      conditions.push(inArray(fonds.id, scope.fondIds))
    }

    const items = await db
      .select()
      .from(fonds)
      .where(and(...conditions))
      .orderBy(fonds.fondName)

    const dossierCountsByFond = await loadArchivedDossierCountsByFond(scope)

    return {
      items: items.map((fond) => ({
        ...fond,
        warehouseDossierCount: dossierCountsByFond.get(fond.id) ?? 0,
      })),
    }
  },

  async getFondSummary(
    profile: UserWithRoles,
    fondId: string,
    statusInput?: string,
  ) {
    const { scope, fondScope } = await resolveWarehouseScope(profile)
    const effectiveFondId = assertFondAccess(scope, fondId)
    const status = resolveWarehouseStatus(statusInput)
    const whereClause = buildArchivedDossierWhere(
      effectiveFondId,
      status,
      undefined,
      undefined,
      scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? scope.dossierTypeIds : undefined,
      scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? scope.documentTypeIds : undefined,
    )

    const dossierRows = await db
      .select({ id: dossiers.id })
      .from(dossiers)
      .where(whereClause)

    const dossierIds = dossierRows.map((row) => row.id)
    const docStats = await loadDocumentStatsByDossierIds(dossierIds)

    let documentCount = 0
    let totalSizeKb = 0
    for (const stats of docStats.values()) {
      documentCount += stats.documentCount
      totalSizeKb += stats.totalSizeKb
    }

    const availableYears = await loadAvailableYears(
      effectiveFondId,
      status,
    )

    return {
      fondId: effectiveFondId,
      dossierCount: dossierIds.length,
      documentCount,
      totalSizeKb,
      availableYears,
      fondScope,
    }
  },

  async browseDossiers(profile: UserWithRoles, query: BrowseArchiveWarehouseQuery) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 20))
    const offset = (page - 1) * limit

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    const effectiveFondId = assertFondAccess(scope, query.fondId)
    const status = resolveWarehouseStatus(query.status)
    const year = query.year != null && !Number.isNaN(query.year) ? query.year : undefined

    const whereClause = buildArchivedDossierWhere(
      effectiveFondId,
      status,
      query.search,
      year,
      scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? scope.dossierTypeIds : undefined,
      scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? scope.documentTypeIds : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: dossiers.id,
          name: dossiers.name,
          folderPath: dossiers.folderPath,
          status: dossiers.status,
          projectCode: dossiers.projectCode,
          archiveStorageState: dossiers.archiveStorageState,
          fondId: dossiers.fondId,
          fondName: fonds.fondName,
          dossierTypeId: dossiers.dossierTypeId,
          dossierTypeName: dossierTypes.name,
          updatedAt: dossiers.updatedAt,
        })
        .from(dossiers)
        .leftJoin(
          fonds,
          and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
        )
        .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
        .where(whereClause)
        .orderBy(desc(dossiers.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dossiers)
        .where(whereClause),
    ])

    const dossierIds = rows.map((row) => row.id)
    const [submissionMap, docStatsMap, placementMap] = await Promise.all([
      loadLatestApprovedSubmissions(dossierIds),
      loadDocumentStatsByDossierIds(dossierIds),
      loadActivePhysicalPlacements(dossierIds),
    ])

    const items = rows.map((row) => {
      const submission = submissionMap.get(row.id)
      const docStats = docStatsMap.get(row.id)
      return {
        ...row,
        documentCount: docStats?.documentCount ?? 0,
        totalSizeKb: docStats?.totalSizeKb ?? 0,
        archivedAt: submission?.reviewedAt ?? null,
        archiveYear: submission?.archiveYear ?? null,
        hasPhysicalPlacement: placementMap.has(row.id),
        physicalBoxName: placementMap.get(row.id) ?? null,
      }
    })

    const total = countRows[0]?.count ?? 0

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fondScope,
      fondId: effectiveFondId,
    }
  },

  async browseUnassignedDossiers(
    profile: UserWithRoles,
    query: { page?: number; limit?: number; search?: string; status?: string },
  ) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 20))
    const offset = (page - 1) * limit

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    assertUnassignedWarehouseAccess(scope)
    const status = resolveWarehouseStatus(query.status)

    const whereClause = buildUnassignedArchivedDossierWhere(
      status,
      query.search,
      scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? scope.dossierTypeIds : undefined,
      scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? scope.documentTypeIds : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: dossiers.id,
          name: dossiers.name,
          folderPath: dossiers.folderPath,
          status: dossiers.status,
          projectCode: dossiers.projectCode,
          archiveStorageState: dossiers.archiveStorageState,
          fondId: dossiers.fondId,
          dossierTypeId: dossiers.dossierTypeId,
          dossierTypeName: dossierTypes.name,
          updatedAt: dossiers.updatedAt,
        })
        .from(dossiers)
        .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
        .where(whereClause)
        .orderBy(desc(dossiers.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dossiers)
        .where(whereClause),
    ])

    const dossierIds = rows.map((row) => row.id)
    const [submissionMap, docStatsMap, placementMap] = await Promise.all([
      loadLatestApprovedSubmissions(dossierIds),
      loadDocumentStatsByDossierIds(dossierIds),
      loadActivePhysicalPlacements(dossierIds),
    ])

    const items = rows.map((row) => {
      const submission = submissionMap.get(row.id)
      const docStats = docStatsMap.get(row.id)
      return {
        ...row,
        fondId: null,
        fondName: null,
        documentCount: docStats?.documentCount ?? 0,
        totalSizeKb: docStats?.totalSizeKb ?? 0,
        archivedAt: submission?.reviewedAt ?? null,
        archiveYear: submission?.archiveYear ?? null,
        hasPhysicalPlacement: placementMap.has(row.id),
        physicalBoxName: placementMap.get(row.id) ?? null,
      }
    })

    const total = countRows[0]?.count ?? 0

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fondScope,
    }
  },

  async getDossierTypeSummary(
    profile: UserWithRoles,
    dossierTypeId: string,
    statusInput?: string,
  ) {
    const trimmedTypeId = dossierTypeId?.trim()
    if (!trimmedTypeId) {
      throw httpError.badRequest("dossierTypeId là bắt buộc")
    }

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này")
    }

    assertDossierTypeAccess(scope, trimmedTypeId)
    const status = resolveWarehouseStatus(statusInput)
    const fondIds = resolveScopedFondIds(scope)

    if (fondIds && fondIds.length === 0) {
      return {
        dossierTypeId: trimmedTypeId,
        dossierCount: 0,
        documentCount: 0,
        totalSizeKb: 0,
        availableYears: [] as number[],
        fondScope,
      }
    }

    const whereClause = buildArchivedDossierWhereByDossierType(
      trimmedTypeId,
      status,
      undefined,
      undefined,
      fondIds,
      scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? scope.documentTypeIds : undefined,
    )

    const dossierRows = await db
      .select({ id: dossiers.id })
      .from(dossiers)
      .where(whereClause)

    const dossierIds = dossierRows.map((row) => row.id)
    const docStats = await loadDocumentStatsByDossierIds(dossierIds)

    let documentCount = 0
    let totalSizeKb = 0
    for (const stats of docStats.values()) {
      documentCount += stats.documentCount
      totalSizeKb += stats.totalSizeKb
    }

    const availableYears = await loadAvailableYearsByDossierType(
      trimmedTypeId,
      status,
      fondIds,
    )

    return {
      dossierTypeId: trimmedTypeId,
      dossierCount: dossierIds.length,
      documentCount,
      totalSizeKb,
      availableYears,
      fondScope,
    }
  },

  async browseDossiersByDossierType(
    profile: UserWithRoles,
    query: BrowseArchiveWarehouseByDossierTypeQuery,
  ) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 20))
    const offset = (page - 1) * limit

    const trimmedTypeId = query.dossierTypeId?.trim()
    if (!trimmedTypeId) {
      throw httpError.badRequest("dossierTypeId là bắt buộc")
    }

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này")
    }

    assertDossierTypeAccess(scope, trimmedTypeId)
    const status = resolveWarehouseStatus(query.status)
    const year = query.year != null && !Number.isNaN(query.year) ? query.year : undefined
    const fondIds = resolveScopedFondIds(scope)

    if (fondIds && fondIds.length === 0) {
      return {
        items: [],
        page,
        limit,
        total: 0,
        totalPages: 0,
        fondScope,
        dossierTypeId: trimmedTypeId,
      }
    }

    const whereClause = buildArchivedDossierWhereByDossierType(
      trimmedTypeId,
      status,
      query.search,
      year,
      fondIds,
      scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? scope.documentTypeIds : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: dossiers.id,
          name: dossiers.name,
          folderPath: dossiers.folderPath,
          status: dossiers.status,
          projectCode: dossiers.projectCode,
          archiveStorageState: dossiers.archiveStorageState,
          fondId: dossiers.fondId,
          fondName: fonds.fondName,
          dossierTypeId: dossiers.dossierTypeId,
          dossierTypeName: dossierTypes.name,
          updatedAt: dossiers.updatedAt,
        })
        .from(dossiers)
        .leftJoin(
          fonds,
          and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
        )
        .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
        .where(whereClause)
        .orderBy(desc(dossiers.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dossiers)
        .where(whereClause),
    ])

    const dossierIds = rows.map((row) => row.id)
    const [submissionMap, docStatsMap, placementMap] = await Promise.all([
      loadLatestApprovedSubmissions(dossierIds),
      loadDocumentStatsByDossierIds(dossierIds),
      loadActivePhysicalPlacements(dossierIds),
    ])

    const items = rows.map((row) => {
      const submission = submissionMap.get(row.id)
      const docStats = docStatsMap.get(row.id)
      return {
        ...row,
        documentCount: docStats?.documentCount ?? 0,
        totalSizeKb: docStats?.totalSizeKb ?? 0,
        archivedAt: submission?.reviewedAt ?? null,
        archiveYear: submission?.archiveYear ?? null,
        hasPhysicalPlacement: placementMap.has(row.id),
        physicalBoxName: placementMap.get(row.id) ?? null,
      }
    })

    const total = countRows[0]?.count ?? 0

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fondScope,
      dossierTypeId: trimmedTypeId,
    }
  },

  async getDocumentTypeSummary(
    profile: UserWithRoles,
    documentTypeId: string,
  ) {
    const trimmedTypeId = documentTypeId?.trim()
    if (!trimmedTypeId) {
      throw httpError.badRequest("documentTypeId là bắt buộc")
    }

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      throw httpError.forbidden("Bạn không có quyền truy cập loại tài liệu này trong kho")
    }

    assertDocumentTypeFilterAccess(scope, trimmedTypeId)
    const fondIds = resolveScopedFondIds(scope)

    if (fondIds && fondIds.length === 0) {
      return {
        documentTypeId: trimmedTypeId,
        documentCount: 0,
        dossierCount: 0,
        totalSizeKb: 0,
        fondScope,
      }
    }

    const whereClause = buildWarehouseDocumentsWhereByDocumentType(
      trimmedTypeId,
      undefined,
      fondIds,
      scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? scope.dossierTypeIds : undefined,
    )

    const [statsRow] = await db
      .select({
        documentCount: sql<number>`count(*)::int`.mapWith(Number),
        dossierCount: sql<number>`count(distinct ${dossiers.id})::int`.mapWith(Number),
        totalSizeKb: sql<number>`coalesce(sum(${dossierFiles.fileSizeKb}), 0)`.mapWith(Number),
      })
      .from(dossierFiles)
      .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
      .where(whereClause)

    return {
      documentTypeId: trimmedTypeId,
      documentCount: statsRow?.documentCount ?? 0,
      dossierCount: statsRow?.dossierCount ?? 0,
      totalSizeKb: statsRow?.totalSizeKb ?? 0,
      fondScope,
    }
  },

  async browseDocumentsByDocumentType(
    profile: UserWithRoles,
    query: BrowseArchiveWarehouseByDocumentTypeQuery,
  ) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 20))
    const offset = (page - 1) * limit

    const trimmedTypeId = query.documentTypeId?.trim()
    if (!trimmedTypeId) {
      throw httpError.badRequest("documentTypeId là bắt buộc")
    }

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      throw httpError.forbidden("Bạn không có quyền truy cập loại tài liệu này trong kho")
    }

    assertDocumentTypeFilterAccess(scope, trimmedTypeId)
    const fondIds = resolveScopedFondIds(scope)

    if (fondIds && fondIds.length === 0) {
      return {
        items: [],
        page,
        limit,
        total: 0,
        totalPages: 0,
        fondScope,
        documentTypeId: trimmedTypeId,
      }
    }

    const whereClause = buildWarehouseDocumentsWhereByDocumentType(
      trimmedTypeId,
      query.search,
      fondIds,
      scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? scope.dossierTypeIds : undefined,
    )

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: dossierFiles.id,
          fileName: dossierFiles.fileName,
          fileSizeKb: dossierFiles.fileSizeKb,
          createdAt: dossierFiles.createdAt,
          documentTypeId: dossierFiles.documentTypeId,
          documentTypeName: documentTypes.name,
          dossierId: dossiers.id,
          dossierName: dossiers.name,
          fondId: dossiers.fondId,
          fondName: fonds.fondName,
        })
        .from(dossierFiles)
        .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
        .leftJoin(
          fonds,
          and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
        )
        .leftJoin(documentTypes, eq(documentTypes.id, dossierFiles.documentTypeId))
        .where(whereClause)
        .orderBy(desc(dossierFiles.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(dossierFiles)
        .innerJoin(dossiers, eq(dossiers.id, dossierFiles.dossierId))
        .where(whereClause),
    ])

    const total = countRows[0]?.count ?? 0

    return {
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      fondScope,
      documentTypeId: trimmedTypeId,
    }
  },

  async getDossierDetail(
    profile: UserWithRoles,
    dossierId: string,
    accessHeaders: SecurityAccessHeaders = {},
  ) {
    const { scope } = await resolveWarehouseScope(profile)

    const [dossier] = await db
      .select({
        id: dossiers.id,
        name: dossiers.name,
        folderPath: dossiers.folderPath,
        status: dossiers.status,
        projectCode: dossiers.projectCode,
        archiveStorageState: dossiers.archiveStorageState,
        fondId: dossiers.fondId,
        fondName: fonds.fondName,
        dossierTypeId: dossiers.dossierTypeId,
        dossierTypeName: dossierTypes.name,
        securityLevelId: dossiers.securityLevelId,
        accessPasswordEnabled: dossiers.accessPasswordEnabled,
        updatedAt: dossiers.updatedAt,
        currentMetadataKey: dossiers.currentMetadataKey,
        ocrMetadataKey: dossiers.ocrMetadataKey,
      })
      .from(dossiers)
      .leftJoin(
        fonds,
        and(eq(fonds.id, dossiers.fondId), isNull(fonds.deletedAt)),
      )
      .leftJoin(dossierTypes, eq(dossierTypes.id, dossiers.dossierTypeId))
      .where(activeDossierWhere(eq(dossiers.id, dossierId)))
      .limit(1)

    if (!dossier) {
      throw httpError.notFound("Không tìm thấy hồ sơ")
    }

    if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
      throw httpError.notFound("Hồ sơ chưa được lưu kho")
    }

    assertWarehouseDossierAccess(scope, dossier)

    const [submissionMap, docStatsMap, placementMap, effectiveRetention] = await Promise.all([
      loadLatestApprovedSubmissions([dossier.id]),
      loadDocumentStatsByDossierIds([dossier.id]),
      loadActivePhysicalPlacements([dossier.id]),
      resolveDossierEffectiveRetention(dossier.id),
    ])
    const submission = submissionMap.get(dossier.id)
    assertDossierTypeAccess(
      scope,
      dossier.dossierTypeId ??
        resolveDossierTypeIdFromFieldValues(submission?.fieldValues),
    )

    if (
      scope.mode === "scoped" &&
      scope.documentTypeIds.length > 0
    ) {
      const [match] = await db
        .select({ id: dossierFiles.id })
        .from(dossierFiles)
        .where(and(
          eq(dossierFiles.dossierId, dossier.id),
          inArray(dossierFiles.documentTypeId, scope.documentTypeIds),
        ))
        .limit(1)
      if (!match) {
        throw httpError.forbidden(
          "Bạn không có quyền truy cập loại tài liệu trong hồ sơ này",
        )
      }
    }
    const docStats = docStatsMap.get(dossier.id)

    await assertSecurityResourceAccess({
      userId: profile.id,
      resourceSecurityLevelId: dossier.securityLevelId,
      permissionDefKey: "view",
      dossierId: dossier.id,
      levelToken: accessHeaders.levelToken,
      levelTokens: accessHeaders.levelTokens,
      dossierToken: accessHeaders.dossierToken,
      fileTokens: accessHeaders.fileTokens,
    })

    const fileRows = await db
      .select({
        id: dossierFiles.id,
        fileName: dossierFiles.fileName,
        filePath: dossierFiles.filePath,
        fileSizeKb: dossierFiles.fileSizeKb,
        documentTypeId: dossierFiles.documentTypeId,
        documentTypeName: documentTypes.name,
        securityLevelId: dossierFiles.securityLevelId,
        createdAt: dossierFiles.createdAt,
      })
      .from(dossierFiles)
      .leftJoin(
        documentTypes,
        eq(documentTypes.id, dossierFiles.documentTypeId),
      )
      .where(eq(dossierFiles.dossierId, dossier.id))
      .orderBy(dossierFiles.fileName)

    const files = await Promise.all(
      fileRows.map(async (file) => {
        const effectiveSecurityLevelId =
          file.securityLevelId ?? dossier.securityLevelId

        const fileBase = {
          id: file.id,
          fileName: file.fileName,
          filePath: file.filePath,
          fileSizeKb: file.fileSizeKb,
          documentTypeId: file.documentTypeId ?? null,
          documentTypeName: file.documentTypeName ?? null,
          securityLevelId: file.securityLevelId ?? null,
          createdAt: file.createdAt,
        }

        const requireFilePassword = effectiveSecurityLevelId
          ? await getEffectiveBool(
            effectiveSecurityLevelId,
            PermissionRuleKey.requireFilePassword,
          )
          : false
        let hasFilePasswordHash = false
        if (requireFilePassword && effectiveSecurityLevelId) {
          const [levelRow] = await db
            .select({ filePasswordHash: securityLevels.filePasswordHash })
            .from(securityLevels)
            .where(eq(securityLevels.id, effectiveSecurityLevelId))
            .limit(1)
          hasFilePasswordHash = Boolean(levelRow?.filePasswordHash)
        }

        if (requireFilePassword && hasFilePasswordHash && effectiveSecurityLevelId) {
          try {
            await assertSecurityResourceAccess({
              userId: profile.id,
              resourceSecurityLevelId: effectiveSecurityLevelId,
              permissionDefKey: "view",
              dossierId: dossier.id,
              fileId: file.id,
              levelToken: accessHeaders.levelToken,
              levelTokens: accessHeaders.levelTokens,
              dossierToken: accessHeaders.dossierToken,
              fileTokens: accessHeaders.fileTokens,
            })
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.startsWith("PASSWORD_REQUIRED:file:")
            ) {
              return {
                ...fileBase,
                accessLocked: true,
                requiredFilePassword: true,
                requiredSecurityLevelId: effectiveSecurityLevelId,
                fileUrl: "",
                searchablePdfPath: null,
                searchablePdfUrl: null,
              }
            }
            throw error
          }
        } else if (effectiveSecurityLevelId !== dossier.securityLevelId) {
          try {
            await assertSecurityResourceAccess({
              userId: profile.id,
              resourceSecurityLevelId: effectiveSecurityLevelId,
              permissionDefKey: "view",
              dossierId: dossier.id,
              fileId: file.id,
              levelToken: accessHeaders.levelToken,
              levelTokens: accessHeaders.levelTokens,
              dossierToken: accessHeaders.dossierToken,
              fileTokens: accessHeaders.fileTokens,
            })
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.startsWith("PASSWORD_REQUIRED:level:")
            ) {
              return {
                ...fileBase,
                accessLocked: true,
                requiredFilePassword: false,
                requiredSecurityLevelId: effectiveSecurityLevelId,
                fileUrl: "",
                searchablePdfPath: null,
                searchablePdfUrl: null,
              }
            }
            throw error
          }
        }

        const searchablePdfPath = toSearchablePdfKey(file.filePath)
        return {
          ...fileBase,
          accessLocked: false,
          requiredFilePassword: false,
          requiredSecurityLevelId: null,
          fileUrl: (await buildLinkGet(file.filePath)) ?? "",
          searchablePdfPath,
          searchablePdfUrl: searchablePdfPath
            ? (await buildLinkGet(searchablePdfPath)) ?? ""
            : null,
        }
      }),
    )

    const metadataKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey
    const metadataKeyJson = metadataKey && !metadataKey.endsWith(".json") ? `${metadataKey}.json` : metadataKey
    const currentMetadataUrl = await buildLinkGet(metadataKeyJson)

    const {
      currentMetadataKey: _currentMetadataKey,
      ocrMetadataKey: _ocrMetadataKey,
      ...dossierPublic
    } = dossier

    const actions = await resolveWarehouseFondActions(
      profile,
      dossier.fondId,
    )

    // Tính quyền download: role dossiers.export + cấp bảo mật cho phép download
    if (userRolesHavePermission(profile.userRoles, Permission.DOSSIERS_EXPORT)) {
      const secLevelId = dossier.securityLevelId
      if (secLevelId) {
        const [blocked, allowOriginal, allowWatermark] = await Promise.all([
          getEffectiveBool(secLevelId, FlagRuleKey.blockExportDownload),
          getEffectiveBool(secLevelId, permissionRuleKey("download_original")),
          getEffectiveBool(secLevelId, permissionRuleKey("download_watermark")),
        ])
        actions.download = !blocked && (allowOriginal || allowWatermark)
      } else {
        // Không có cấp bảo mật → dùng mặc định (cho phép)
        actions.download = true
      }
    }

    const docTypeIds = [
      ...new Set(
        files
          .map((f) => f.documentTypeId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    let metadataViewAccess: Record<string, string[] | null> = {}
    if (docTypeIds.length > 0) {
      const templateRow = await db.query.metadataTemplates.findFirst({
        where: and(
          eq(metadataTemplates.isActive, true),
          isNull(metadataTemplates.deletedAt),
        ),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        columns: { fieldCatalog: true },
      })
      const catalog = templateRow
        ? parseFieldCatalog(templateRow.fieldCatalog)
        : []
      const catalogKeysByDocType = new Map<string, string[]>()
      for (const docTypeId of docTypeIds) {
        catalogKeysByDocType.set(
          docTypeId,
          catalog
            .filter((e) => e.groupCode === docTypeId)
            .map((e) => e.key),
        )
      }
      metadataViewAccess = await resolveMetadataViewAccessForDocumentTypes(
        profile,
        docTypeIds,
        catalogKeysByDocType,
      )
    }

    return {
      dossier: {
        ...dossierPublic,
        documentCount: docStats?.documentCount ?? 0,
        totalSizeKb: docStats?.totalSizeKb ?? 0,
        archivedAt: submission?.reviewedAt ?? null,
        archiveYear: submission?.archiveYear ?? null,
        hasPhysicalPlacement: placementMap.has(dossier.id),
        physicalBoxName: placementMap.get(dossier.id) ?? null,
        effectiveRetentionPeriodId: effectiveRetention?.id ?? null,
        effectiveRetentionPeriodName: formatEffectiveRetentionDisplay(
          effectiveRetention,
        ),
      },
      archiveSubmission: submission
        ? {
          reviewedAt: submission.reviewedAt,
          fieldValues: submission.fieldValues,
          fieldConfigSnapshot: submission.fieldConfigSnapshot,
          archiveYear: submission.archiveYear,
        }
        : null,
      files,
      currentMetadataUrl,
      metadataViewAccess,
      actions,
    }
  },

  async searchContent(
    profile: UserWithRoles,
    input: {
      q?: string
      fondId?: string
      limit?: number
      offset?: number
      groupCode?: string
      trangThaiHoSo?: string
      dossierTypeId?: string
      documentTypeId?: string
      editorName?: string
      editCompletedAtFrom?: string
      editCompletedAtTo?: string
      archivedAtFrom?: string
      archivedAtTo?: string
    },
  ) {
    const q = input.q?.trim() ?? ""
    const limit = Math.min(input.limit ?? 20, 50)
    const offset = input.offset ?? 0

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (!q || scope.mode === "none") {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope: scope.mode === "scoped" || scope.mode === "fond" ? scope.fondIds : scope.mode === "global" ? null : [],
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    let fondIds: string[] | undefined
    if (input.fondId) {
      const effectiveFondId = assertFondAccess(scope, input.fondId)
      fondIds = [effectiveFondId]
    } else if (scope.mode === "scoped" || scope.mode === "fond") {
      fondIds = scope.fondIds
    }

    if (fondIds && fondIds.length === 0) {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope,
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    if (
      input.dossierTypeId?.trim() &&
      scope.mode === "scoped" &&
      scope.dossierTypeIds.length > 0 &&
      !scope.dossierTypeIds.includes(input.dossierTypeId.trim())
    ) {
      throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này trong kho")
    }
    assertDocumentTypeFilterAccess(scope, input.documentTypeId)

    const result = await searchDocuments({
      q,
      groupCode: input.groupCode,
      trangThaiHoSo: input.trangThaiHoSo,
      dossierTypeId: input.dossierTypeId,
      documentTypeId: input.documentTypeId,
      editorName: input.editorName,
      editCompletedAtFrom: input.editCompletedAtFrom,
      editCompletedAtTo: input.editCompletedAtTo,
      archivedAtFrom: input.archivedAtFrom,
      archivedAtTo: input.archivedAtTo,
      filters: {
        entityTypes: [DOSSIER_ENTITY_TYPE],
        dossierStatus: DossierStatus.ARCHIVED,
        ...(fondIds ? { fondIds } : {}),
        ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? { dossierTypeIds: scope.dossierTypeIds } : {}),
        ...(scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? { documentTypeIds: scope.documentTypeIds } : {}),
      },
      from: offset,
      size: limit,
    })

    const { hits, staleCount, deniedCount } = await filterDossierHitsAgainstDb(
      result.hits,
    )
    const total = Math.max(result.total - staleCount - deniedCount, 0)

    return {
      items: hits.map((hit) => ({
        entityType: hit.entityType,
        entityId: hit.entityId,
        title: hit.title,
        fondId: hit.fondId ?? null,
        fondName: hit.fondName ?? null,
        dossierTypeId: hit.dossierTypeId ?? null,
        dossierTypeName: hit.dossierTypeName ?? null,
        documentTypeIds: hit.documentTypeIds ?? [],
        documentTypeNames: hit.documentTypeNames ?? [],
        effectiveRetentionPeriodId: hit.effectiveRetentionPeriodId ?? null,
        effectiveRetentionPeriodName: hit.effectiveRetentionPeriodName ?? null,
        editorId: hit.editorId ?? null,
        editorName: hit.editorName ?? null,
        editCompletedAt: hit.editCompletedAt ?? null,
        archivedAt: hit.archivedAt ?? null,
        fileNames: hit.fileNames ?? [],
        hoSoId: hit.hoSoId ?? null,
        trangThaiHoSo: hit.trangThaiHoSo ?? null,
        snippet: hit.snippet,
        score: hit.score,
        matches: hit.matches ?? [],
        metadata: hit.metadata ?? {},
      })),
      total,
      took_ms: result.took,
      fondScope,
      message: total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
    }
  },

  async searchUnified(
    profile: UserWithRoles,
    input: {
      q?: string
      fondId?: string
      limit?: number
      offset?: number
      groupCode?: string
      trangThaiHoSo?: string
      dossierTypeId?: string
      documentTypeId?: string
      editorName?: string
      editCompletedAtFrom?: string
      editCompletedAtTo?: string
      archivedAtFrom?: string
      archivedAtTo?: string
    },
  ) {
    const q = input.q?.trim() ?? ""
    const limit = Math.min(input.limit ?? 20, 50)
    const offset = input.offset ?? 0

    const { scope, fondScope } = await resolveWarehouseScope(profile)
    if (!q || scope.mode === "none") {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope: scope.mode === "scoped" || scope.mode === "fond" ? scope.fondIds : scope.mode === "global" ? null : [],
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    let fondIds: string[] | undefined
    if (input.fondId) {
      const effectiveFondId = assertFondAccess(scope, input.fondId)
      fondIds = [effectiveFondId]
    } else if (scope.mode === "scoped" || scope.mode === "fond") {
      fondIds = scope.fondIds
    }

    if (fondIds && fondIds.length === 0) {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope,
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    if (
      input.dossierTypeId?.trim() &&
      scope.mode === "scoped" &&
      scope.dossierTypeIds.length > 0 &&
      !scope.dossierTypeIds.includes(input.dossierTypeId.trim())
    ) {
      throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này trong kho")
    }
    assertDocumentTypeFilterAccess(scope, input.documentTypeId)

    const result = await searchUnifiedDocuments({
      q,
      groupCode: input.groupCode,
      trangThaiHoSo: input.trangThaiHoSo,
      dossierTypeId: input.dossierTypeId,
      documentTypeId: input.documentTypeId,
      editorName: input.editorName,
      editCompletedAtFrom: input.editCompletedAtFrom,
      editCompletedAtTo: input.editCompletedAtTo,
      archivedAtFrom: input.archivedAtFrom,
      archivedAtTo: input.archivedAtTo,
      filters: {
        entityTypes: [DOSSIER_ENTITY_TYPE],
        dossierStatus: DossierStatus.ARCHIVED,
        ...(fondIds ? { fondIds } : {}),
        ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? { dossierTypeIds: scope.dossierTypeIds } : {}),
        ...(scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? { documentTypeIds: scope.documentTypeIds } : {}),
      },
      from: offset,
      size: limit,
    })

    const { hits, staleCount } = await filterDossierHitsAgainstDb(result.hits)
    const total = Math.max(result.total - staleCount, 0)

    return {
      items: hits.map((hit) => ({
        entityType: hit.entityType,
        entityId: hit.entityId,
        title: hit.title,
        fondId: hit.fondId ?? null,
        fondName: hit.fondName ?? null,
        dossierTypeId: hit.dossierTypeId ?? null,
        dossierTypeName: hit.dossierTypeName ?? null,
        documentTypeIds: hit.documentTypeIds ?? [],
        documentTypeNames: hit.documentTypeNames ?? [],
        effectiveRetentionPeriodId: hit.effectiveRetentionPeriodId ?? null,
        effectiveRetentionPeriodName: hit.effectiveRetentionPeriodName ?? null,
        editorId: hit.editorId ?? null,
        editorName: hit.editorName ?? null,
        editCompletedAt: hit.editCompletedAt ?? null,
        archivedAt: hit.archivedAt ?? null,
        fileNames: hit.fileNames ?? [],
        hoSoId: hit.hoSoId ?? null,
        trangThaiHoSo: hit.trangThaiHoSo ?? null,
        snippet: hit.snippet,
        score: hit.score,
        matches: hit.matches ?? [],
        metadata: hit.metadata ?? {},
      })),
      total,
      took_ms: result.took,
      fondScope,
      message: total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
    }
  },

  async searchMetadata(
    profile: UserWithRoles,
    input: {
      dossierName?: string
      documentName?: string
      fondId?: string
      dossierTypeId?: string
      documentTypeId?: string
      editorName?: string
      editCompletedAtFrom?: string
      editCompletedAtTo?: string
      archivedAtFrom?: string
      archivedAtTo?: string
      limit?: number
      offset?: number
    },
  ) {
    const limit = Math.min(input.limit ?? 20, 50)
    const offset = input.offset ?? 0
    const { scope, fondScope } = await resolveWarehouseScope(profile)

    if (scope.mode === "none") {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope: [],
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    const hasCriteria = Boolean(
      input.dossierName?.trim() ||
        input.documentName?.trim() ||
        input.dossierTypeId?.trim() ||
        input.documentTypeId?.trim() ||
        input.editorName?.trim() ||
        input.editCompletedAtFrom?.trim() ||
        input.editCompletedAtTo?.trim() ||
        input.archivedAtFrom?.trim() ||
        input.archivedAtTo?.trim() ||
        input.fondId?.trim(),
    )

    if (!hasCriteria) {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope,
        message: "Vui lòng nhập ít nhất một tiêu chí tra cứu",
      }
    }

    let fondIds: string[] | undefined
    if (input.fondId?.trim()) {
      const effectiveFondId = assertFondAccess(scope, input.fondId.trim())
      fondIds = [effectiveFondId]
    } else if (scope.mode === "scoped" || scope.mode === "fond") {
      fondIds = scope.fondIds
    }

    if (fondIds && fondIds.length === 0) {
      return {
        items: [],
        total: 0,
        took_ms: 0,
        fondScope,
        message: "Không tìm thấy kết quả phù hợp",
      }
    }

    if (
      input.dossierTypeId?.trim() &&
      scope.mode === "scoped" &&
      scope.dossierTypeIds.length > 0 &&
      !scope.dossierTypeIds.includes(input.dossierTypeId.trim())
    ) {
      throw httpError.forbidden("Bạn không có quyền truy cập loại hồ sơ này trong kho")
    }
    assertDocumentTypeFilterAccess(scope, input.documentTypeId)

    const result = await searchMetadataDocuments({
      dossierName: input.dossierName,
      documentName: input.documentName,
      fondIds,
      dossierTypeId: input.dossierTypeId,
      documentTypeId: input.documentTypeId,
      editorName: input.editorName,
      editCompletedAtFrom: input.editCompletedAtFrom,
      editCompletedAtTo: input.editCompletedAtTo,
      archivedAtFrom: input.archivedAtFrom,
      archivedAtTo: input.archivedAtTo,
      filters: {
        entityTypes: [DOSSIER_ENTITY_TYPE],
        dossierStatus: DossierStatus.ARCHIVED,
        ...(scope.mode === "scoped" && scope.dossierTypeIds.length > 0 ? { dossierTypeIds: scope.dossierTypeIds } : {}),
        ...(scope.mode === "scoped" && scope.documentTypeIds.length > 0 ? { documentTypeIds: scope.documentTypeIds } : {}),
      },
      from: offset,
      size: limit,
    })

    const { hits, staleCount, deniedCount } = await filterDossierHitsAgainstDb(
      result.hits,
    )
    const total = Math.max(result.total - staleCount - deniedCount, 0)

    return {
      items: hits.map((hit) => ({
        entityType: hit.entityType,
        entityId: hit.entityId,
        title: hit.title,
        fondId: hit.fondId ?? null,
        fondName: hit.fondName ?? null,
        dossierTypeId: hit.dossierTypeId ?? null,
        dossierTypeName: hit.dossierTypeName ?? null,
        documentTypeIds: hit.documentTypeIds ?? [],
        documentTypeNames: hit.documentTypeNames ?? [],
        effectiveRetentionPeriodId: hit.effectiveRetentionPeriodId ?? null,
        effectiveRetentionPeriodName: hit.effectiveRetentionPeriodName ?? null,
        editorId: hit.editorId ?? null,
        editorName: hit.editorName ?? null,
        editCompletedAt: hit.editCompletedAt ?? null,
        archivedAt: hit.archivedAt ?? null,
        fileNames: hit.fileNames ?? [],
        hoSoId: hit.hoSoId ?? null,
        trangThaiHoSo: hit.trangThaiHoSo ?? null,
        score: hit.score,
        metadata: hit.metadata ?? {},
      })),
      total,
      took_ms: result.took,
      fondScope,
      message: total === 0 ? "Không tìm thấy kết quả phù hợp" : null,
    }
  },

  async listDossierTypes(profile: UserWithRoles) {
    const { scope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      return { items: [] as Array<{ id: string; name: string; dossierCount: number }> }
    }

    // Dropdown: danh mục loại hồ sơ đang hoạt động (giống loại tài liệu).
    // Kết quả lọc vẫn qua ACL + dossierTypeScopeCondition khi search.
    let rows: Array<{ id: string; name: string }>
    if (scope.mode === "scoped" && scope.dossierTypeIds.length > 0) {
      rows = await db
        .select({
          id: dossierTypes.id,
          name: dossierTypes.name,
        })
        .from(dossierTypes)
        .where(and(
          inArray(dossierTypes.id, scope.dossierTypeIds),
          eq(dossierTypes.isActive, true),
        ))
        .orderBy(dossierTypes.name)
    } else {
      rows = await db
        .select({
          id: dossierTypes.id,
          name: dossierTypes.name,
        })
        .from(dossierTypes)
        .where(eq(dossierTypes.isActive, true))
        .orderBy(dossierTypes.name)
    }

    const counts = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        count: await loadArchivedDossierCountForType(scope, row.id),
      })),
    )
    const countMap = new Map(counts.map((entry) => [entry.id, entry.count]))

    return {
      items: rows.map((row) => ({
        ...row,
        dossierCount: countMap.get(row.id) ?? 0,
      })),
    }
  },

  async listDocumentTypes(profile: UserWithRoles) {
    const { scope } = await resolveWarehouseScope(profile)
    if (scope.mode === "none") {
      return { items: [] as Array<{ id: string; name: string; documentCount: number }> }
    }

    // Dropdown: toàn bộ catalog (lọc kết quả vẫn qua ACL khi search).
    // Khi scoped type-only thì chỉ trả loại được gán.
    let rows: Array<{ id: string; name: string }>
    if (scope.mode === "scoped" && scope.documentTypeIds.length > 0) {
      rows = await db
        .select({
          id: documentTypes.id,
          name: documentTypes.name,
        })
        .from(documentTypes)
        .where(and(
          inArray(documentTypes.id, scope.documentTypeIds),
          eq(documentTypes.isActive, true),
        ))
        .orderBy(documentTypes.name)
    } else {
      rows = await db
        .select({
          id: documentTypes.id,
          name: documentTypes.name,
        })
        .from(documentTypes)
        .where(eq(documentTypes.isActive, true))
        .orderBy(documentTypes.name)
    }

    const documentCountsByType = await loadArchivedDocumentCountsByDocumentType(
      scope,
      rows.map((row) => row.id),
    )

    return {
      items: rows.map((row) => ({
        ...row,
        documentCount: documentCountsByType.get(row.id) ?? 0,
      })),
    }
  },

  async updateFileDocumentType(
    profile: UserWithRoles,
    input: {
      dossierId: string
      fileId: string
      documentTypeId: string | null
      securityLevelId?: string | null
    },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT)) {
      throw httpError.forbidden("Bạn không có quyền sửa loại tài liệu trong kho")
    }

    const { dossier, file } = await loadArchivedFileForWarehouse(
      profile,
      input.dossierId,
      input.fileId,
      Permission.ARCHIVE_WAREHOUSE_EDIT,
    )

    const nextTypeId = input.documentTypeId?.trim() || null
    if (nextTypeId) {
      const typeRow = await db.query.documentTypes.findFirst({
        where: and(
          eq(documentTypes.id, nextTypeId),
          eq(documentTypes.isActive, true),
        ),
        columns: { id: true, name: true },
      })
      if (!typeRow) {
        throw httpError.notFound("Không tìm thấy loại tài liệu hoặc đã ngưng hoạt động")
      }
      assertDocumentTypeFilterAccess(
        await ArchiveScopeResolver.resolve(profile, {
          warehousePermission: Permission.ARCHIVE_WAREHOUSE_EDIT,
        }),
        nextTypeId,
      )
    }

    if (input.securityLevelId !== undefined) {
      await assertActiveSecurityLevelId(input.securityLevelId)
    }

    const filePatch: {
      documentTypeId: string | null
      securityLevelId?: string | null
    } = { documentTypeId: nextTypeId }
    if (input.securityLevelId !== undefined) {
      filePatch.securityLevelId = input.securityLevelId
    }

    await db
      .update(dossierFiles)
      .set(filePatch)
      .where(eq(dossierFiles.id, file.id))

    const [updatedFile] = await db
      .select({ securityLevelId: dossierFiles.securityLevelId })
      .from(dossierFiles)
      .where(eq(dossierFiles.id, file.id))
      .limit(1)

    // Reindex ES so documentTypeIds stay in sync.
    void indexDossierById(dossier.id).catch((error) => {
      console.warn("[Warehouse] Failed to reindex after document type update:", error)
    })

    const typeName = nextTypeId
      ? (
        await db.query.documentTypes.findFirst({
          where: eq(documentTypes.id, nextTypeId),
          columns: { name: true },
        })
      )?.name ?? null
      : null

    return {
      file: {
        id: file.id,
        dossierId: dossier.id,
        documentTypeId: nextTypeId,
        documentTypeName: typeName,
        securityLevelId: updatedFile?.securityLevelId ?? null,
      },
    }
  },

  async createReuploadUploadPoint(
    profile: UserWithRoles,
    input: { dossierId: string; fileId: string },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_REUPLOAD)) {
      throw httpError.forbidden("Bạn không có quyền upload lại file trong kho")
    }
    const { dossier, file } = await loadArchivedFileForWarehouse(
      profile,
      input.dossierId,
      input.fileId,
      Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
    )

    const rawPrefix = getRawStoragePrefix()
    const prefix = `${rawPrefix}/warehouse-reupload/${dossier.id}/`

    const uploadPoint = await DossierService.createUploadPoint({
      prefix,
      projectCode: dossier.projectCode ?? undefined,
      contentTypePrefix: "application/pdf",
      runMode: "manual",
    })

    return {
      ...uploadPoint,
      sourceFileId: file.id,
      sourceFileName: file.fileName,
      suggestedFileName: file.fileName,
    }
  },

  async reuploadFile(
    profile: UserWithRoles,
    input: {
      dossierId: string
      fileId: string
      /** When set, PDF already uploaded to staging; replaces the selected file then reopens OCR. */
      key?: string
    },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_REUPLOAD)) {
      throw httpError.forbidden("Bạn không có quyền upload lại file trong kho")
    }
    const { dossier, file } = await loadArchivedFileForWarehouse(
      profile,
      input.dossierId,
      input.fileId,
      Permission.ARCHIVE_WAREHOUSE_REUPLOAD,
    )

    const rawPrefix = getRawStoragePrefix()
    let nextFilePath = file.filePath
    let nextFileName = file.fileName
    let nextSizeKb = file.fileSizeKb

    if (input.key?.trim()) {
      const stagedKey = normalizeStorageKey(input.key.trim())
      const stagingPrefix = `${rawPrefix}/warehouse-reupload/${dossier.id}/`
      if (!stagedKey.startsWith(stagingPrefix) && !stagedKey.startsWith(`${rawPrefix}/`)) {
        throw httpError.badRequest("File upload phải nằm trong thư mục raw/")
      }

      nextFileName = storageBasename(stagedKey) || file.fileName
      nextFilePath = resolveWorkingFilePath({
        folderPath: dossier.folderPath,
        currentFilePath: file.filePath,
        fileName: nextFileName,
      })

      await copyStorageObject(stagedKey, nextFilePath)
      const { size } = await statStorageObject(nextFilePath)
      nextSizeKb = Math.max(1, Math.ceil(size / 1024))

      if (
        nextFilePath !== normalizeStorageKey(file.filePath) &&
        !isProtectedArchivalKey(file.filePath)
      ) {
        await deleteStorageObjectQuiet(file.filePath)
      }

      await db
        .update(dossierFiles)
        .set({
          fileName: nextFileName,
          filePath: nextFilePath,
          fileSizeKb: nextSizeKb,
        })
        .where(eq(dossierFiles.id, file.id))
    }

    const reopen = await reopenDossierForOcr({
      dossierId: dossier.id,
      actorId: profile.id,
      notes: `Reupload file ${file.fileName} (fileId=${file.id})`,
    })

    return {
      dossierId: dossier.id,
      fileId: file.id,
      file: {
        id: file.id,
        fileName: nextFileName,
        filePath: nextFilePath,
        fileSizeKb: nextSizeKb,
      },
      status: reopen.status,
      fromStatus: reopen.fromStatus,
      message: "Đã cập nhật file và mở lại hồ sơ. Hồ sơ chuyển sang trạng thái NEW và chờ kích hoạt OCR trên màn Kiểm soát OCR.",
    }
  },

  async deleteFile(
    profile: UserWithRoles,
    input: { dossierId: string; fileId: string },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_DELETE)) {
      throw httpError.forbidden("Bạn không có quyền xóa file trong kho")
    }
    const { dossier, file } = await loadArchivedFileForWarehouse(
      profile,
      input.dossierId,
      input.fileId,
      Permission.ARCHIVE_WAREHOUSE_DELETE,
    )

    const [{ value: fileCount }] = await db
      .select({ value: count() })
      .from(dossierFiles)
      .where(eq(dossierFiles.dossierId, dossier.id))

    if (Number(fileCount) <= 1) {
      throw httpError.badRequest("Không thể xóa file cuối cùng của hồ sơ")
    }

    await db.delete(dossierFiles).where(eq(dossierFiles.id, file.id))
    if (!isProtectedArchivalKey(file.filePath)) {
      await deleteStorageObjectQuiet(file.filePath)
    }

    const reopen = await reopenDossierForOcr({
      dossierId: dossier.id,
      actorId: profile.id,
      notes: `Deleted file ${file.fileName} (fileId=${file.id})`,
    })

    return {
      dossierId: dossier.id,
      deletedFileId: file.id,
      status: reopen.status,
      message: "Đã xóa file và mở lại hồ sơ. Hồ sơ chuyển sang trạng thái NEW và chờ kích hoạt OCR trên màn Kiểm soát OCR.",
    }
  },

  async deleteFiles(
    profile: UserWithRoles,
    input: { dossierId: string; fileIds: string[] },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_DELETE)) {
      throw httpError.forbidden("Bạn không có quyền xóa file trong kho")
    }

    const fileIds = [...new Set(input.fileIds)]
    if (fileIds.length === 0) {
      throw httpError.badRequest("Cần chọn ít nhất một file để xóa")
    }
    if (fileIds.length > 100) {
      throw httpError.badRequest("Chỉ có thể xóa tối đa 100 file mỗi lần")
    }

    const dossier = await loadArchivedDossierForWarehouse(
      profile,
      input.dossierId,
      Permission.ARCHIVE_WAREHOUSE_DELETE,
    )
    const [selectedFiles, [{ value: fileCount }]] = await Promise.all([
      db
        .select({
          id: dossierFiles.id,
          fileName: dossierFiles.fileName,
          filePath: dossierFiles.filePath,
        })
        .from(dossierFiles)
        .where(and(
          eq(dossierFiles.dossierId, dossier.id),
          inArray(dossierFiles.id, fileIds),
        )),
      db
        .select({ value: count() })
        .from(dossierFiles)
        .where(eq(dossierFiles.dossierId, dossier.id)),
    ])

    if (selectedFiles.length !== fileIds.length) {
      throw httpError.badRequest(
        "Một hoặc nhiều file không tồn tại trong hồ sơ này",
      )
    }
    if (Number(fileCount) <= selectedFiles.length) {
      throw httpError.badRequest(
        "Không thể xóa toàn bộ file của hồ sơ; phải giữ lại ít nhất một file",
      )
    }

    await db
      .delete(dossierFiles)
      .where(and(
        eq(dossierFiles.dossierId, dossier.id),
        inArray(dossierFiles.id, fileIds),
      ))
    await Promise.all(
      selectedFiles
        .filter((file) => !isProtectedArchivalKey(file.filePath))
        .map((file) => deleteStorageObjectQuiet(file.filePath)),
    )

    const reopen = await reopenDossierForOcr({
      dossierId: dossier.id,
      actorId: profile.id,
      notes: `Deleted ${selectedFiles.length} files: ${selectedFiles.map((file) => file.fileName).join(", ")}`,
    })

    return {
      dossierId: dossier.id,
      deletedFileIds: fileIds,
      deletedCount: selectedFiles.length,
      status: reopen.status,
      message: `Đã xóa ${selectedFiles.length} file và mở lại hồ sơ. Hồ sơ chờ kích hoạt OCR trên màn Kiểm soát OCR.`,
    }
  },

  async moveFile(
    profile: UserWithRoles,
    input: { dossierId: string; fileId: string; targetDossierId: string },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT)) {
      throw httpError.forbidden("Bạn không có quyền chuyển file trong kho")
    }
    if (input.dossierId === input.targetDossierId) {
      throw httpError.badRequest("Hồ sơ đích phải khác hồ sơ nguồn")
    }

    const { dossier: source, file } = await loadArchivedFileForWarehouse(
      profile,
      input.dossierId,
      input.fileId,
      Permission.ARCHIVE_WAREHOUSE_EDIT,
    )
    const target = await loadArchivedDossierForWarehouse(
      profile,
      input.targetDossierId,
      Permission.ARCHIVE_WAREHOUSE_EDIT,
    )

    const [{ value: sourceCount }] = await db
      .select({ value: count() })
      .from(dossierFiles)
      .where(eq(dossierFiles.dossierId, source.id))

    if (Number(sourceCount) <= 1) {
      throw httpError.badRequest("Không thể chuyển file cuối cùng khỏi hồ sơ nguồn")
    }

    const moveResult = await executeWarehouseFileMove({
      file,
      source: { id: source.id },
      target: { id: target.id, folderPath: target.folderPath },
    })

    const [sourceReopen, targetReopen] = await Promise.all([
      reopenDossierForOcr({
        dossierId: source.id,
        actorId: profile.id,
        notes: `Moved file ${moveResult.destFileName} to dossier ${target.id}`,
      }),
      reopenDossierForOcr({
        dossierId: target.id,
        actorId: profile.id,
        notes: `Received file ${moveResult.destFileName} from dossier ${source.id}`,
      }),
    ])

    return {
      sourceDossierId: source.id,
      targetDossierId: target.id,
      fileId: file.id,
      sourceStatus: sourceReopen.status,
      targetStatus: targetReopen.status,
      destFileName: moveResult.destFileName,
      destFilePath: moveResult.destPath,
      renamed: moveResult.renamed,
      message: moveResult.renamed
        ? "Đã chuyển file (đổi tên do trùng tên tại hồ sơ đích). Cả hai hồ sơ chuyển sang NEW và chờ kích hoạt OCR trên màn Kiểm soát OCR."
        : "Đã chuyển file. Cả hai hồ sơ chuyển sang NEW và chờ kích hoạt OCR trên màn Kiểm soát OCR.",
    }
  },

  async moveFiles(
    profile: UserWithRoles,
    input: {
      dossierId: string
      fileIds: string[]
      targetDossierId: string
    },
  ) {
    if (!hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT)) {
      throw httpError.forbidden("Bạn không có quyền chuyển file trong kho")
    }
    if (input.dossierId === input.targetDossierId) {
      throw httpError.badRequest("Hồ sơ đích phải khác hồ sơ nguồn")
    }

    const fileIds = [...new Set(input.fileIds)]
    if (fileIds.length === 0) {
      throw httpError.badRequest("Cần chọn ít nhất một file để chuyển")
    }
    if (fileIds.length > 100) {
      throw httpError.badRequest("Chỉ có thể chuyển tối đa 100 file mỗi lần")
    }

    const source = await loadArchivedDossierForWarehouse(
      profile,
      input.dossierId,
      Permission.ARCHIVE_WAREHOUSE_EDIT,
    )
    const target = await loadArchivedDossierForWarehouse(
      profile,
      input.targetDossierId,
      Permission.ARCHIVE_WAREHOUSE_EDIT,
    )
    const [selectedFiles, [{ value: sourceCount }]] = await Promise.all([
      db
        .select({
          id: dossierFiles.id,
          fileName: dossierFiles.fileName,
          filePath: dossierFiles.filePath,
          fileSizeKb: dossierFiles.fileSizeKb,
        })
        .from(dossierFiles)
        .where(and(
          eq(dossierFiles.dossierId, source.id),
          inArray(dossierFiles.id, fileIds),
        )),
      db
        .select({ value: count() })
        .from(dossierFiles)
        .where(eq(dossierFiles.dossierId, source.id)),
    ])

    if (selectedFiles.length !== fileIds.length) {
      throw httpError.badRequest(
        "Một hoặc nhiều file không tồn tại trong hồ sơ nguồn",
      )
    }
    if (Number(sourceCount) <= selectedFiles.length) {
      throw httpError.badRequest(
        "Không thể chuyển toàn bộ file; hồ sơ nguồn phải còn ít nhất một file",
      )
    }

    const movedFiles = []
    for (const file of selectedFiles) {
      const result = await executeWarehouseFileMove({
        file,
        source: { id: source.id },
        target: { id: target.id, folderPath: target.folderPath },
      })
      movedFiles.push({
        fileId: file.id,
        destFileName: result.destFileName,
        destFilePath: result.destPath,
        renamed: result.renamed,
      })
    }

    const [sourceReopen, targetReopen] = await Promise.all([
      reopenDossierForOcr({
        dossierId: source.id,
        actorId: profile.id,
        notes: `Moved ${movedFiles.length} files to dossier ${target.id}`,
      }),
      reopenDossierForOcr({
        dossierId: target.id,
        actorId: profile.id,
        notes: `Received ${movedFiles.length} files from dossier ${source.id}`,
      }),
    ])

    return {
      sourceDossierId: source.id,
      targetDossierId: target.id,
      movedFiles,
      movedCount: movedFiles.length,
      sourceStatus: sourceReopen.status,
      targetStatus: targetReopen.status,
      message: `Đã chuyển ${movedFiles.length} file. Cả hai hồ sơ chuyển sang NEW và chờ kích hoạt OCR trên màn Kiểm soát OCR.`,
    }
  },
}

async function loadArchivedDossierForWarehouse(
  profile: UserWithRoles,
  dossierId: string,
  warehousePermission: string,
) {
  const scope = await ArchiveScopeResolver.resolve(profile, {
    warehousePermission,
  })
  if (scope.mode === "none") {
    throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ này trong kho")
  }

  const [dossier] = await db
    .select({
      id: dossiers.id,
      name: dossiers.name,
      folderPath: dossiers.folderPath,
      status: dossiers.status,
      projectCode: dossiers.projectCode,
      fondId: dossiers.fondId,
      dossierTypeId: dossiers.dossierTypeId,
      currentMetadataKey: dossiers.currentMetadataKey,
      ocrMetadataKey: dossiers.ocrMetadataKey,
    })
    .from(dossiers)
    .where(activeDossierWhere(eq(dossiers.id, dossierId)))
    .limit(1)

  if (!dossier) {
    throw httpError.notFound("Không tìm thấy hồ sơ")
  }

  if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
    throw httpError.notFound("Hồ sơ chưa được lưu kho")
  }

  assertWarehouseDossierAccess(scope, dossier)
  assertDossierTypeAccess(scope, dossier.dossierTypeId)

  return dossier
}

async function loadArchivedFileForWarehouse(
  profile: UserWithRoles,
  dossierId: string,
  fileId: string,
  warehousePermission: string = Permission.ARCHIVE_WAREHOUSE_READ,
) {
  const scope = await ArchiveScopeResolver.resolve(profile, {
    warehousePermission,
  })
  if (scope.mode === "none") {
    throw httpError.forbidden("Bạn không có quyền truy cập hồ sơ này trong kho")
  }

  const [dossier] = await db
    .select({
      id: dossiers.id,
      name: dossiers.name,
      folderPath: dossiers.folderPath,
      status: dossiers.status,
      projectCode: dossiers.projectCode,
      fondId: dossiers.fondId,
      dossierTypeId: dossiers.dossierTypeId,
      currentMetadataKey: dossiers.currentMetadataKey,
      ocrMetadataKey: dossiers.ocrMetadataKey,
    })
    .from(dossiers)
    .where(activeDossierWhere(eq(dossiers.id, dossierId)))
    .limit(1)

  if (!dossier) {
    throw httpError.notFound("Không tìm thấy hồ sơ")
  }

  if (!(WAREHOUSE_DOSSIER_STATUSES as ReadonlyArray<string>).includes(dossier.status)) {
    throw httpError.notFound("Hồ sơ chưa được lưu kho")
  }

  assertWarehouseDossierAccess(scope, dossier)
  assertDossierTypeAccess(scope, dossier.dossierTypeId)

  const [file] = await db
    .select({
      id: dossierFiles.id,
      fileName: dossierFiles.fileName,
      filePath: dossierFiles.filePath,
      fileSizeKb: dossierFiles.fileSizeKb,
      dossierId: dossierFiles.dossierId,
    })
    .from(dossierFiles)
    .where(and(
      eq(dossierFiles.id, fileId),
      eq(dossierFiles.dossierId, dossier.id),
    ))
    .limit(1)

  if (!file) {
    throw httpError.notFound("Không tìm thấy văn bản trong hồ sơ")
  }

  return { dossier, file }
}
