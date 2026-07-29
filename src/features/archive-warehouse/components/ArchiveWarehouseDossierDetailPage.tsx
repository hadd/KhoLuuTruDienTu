import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { FileText, FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DossierPhysicalLocationSection } from '@/features/archive-submission/components/DossierPhysicalLocationSection'
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import {
  ArchiveWarehouseFileViewer,
  ArchiveWarehouseFileViewerPanels,
  ArchiveWarehouseFileViewerToolbar,
} from '@/features/archive-warehouse/components/ArchiveWarehouseFileViewer'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import {
  canDeleteArchiveWarehouse,
  canEditArchiveWarehouse,
  canManageArchiveWarehousePhysical,
  canReuploadArchiveWarehouse,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { formatArchiveFieldDisplay } from '@/features/archive-warehouse/lib/formatArchiveFieldDisplay'
import { buildSimplifiedBrowseBreadcrumbSegments } from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import {
  archiveWarehouseDossierDetailQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDocumentTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import { warehouseSubTabsTriggerClassName } from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { verifySecurityLevelAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  clearDossierAccessSession,
  getRememberedDossierSecurityLevel,
  getSecurityLevelAccessToken,
  rememberDossierUnlockedSecurityLevel,
  rememberDossierSecurityLevel,
  setSecurityLevelAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

function formatSecurityLevelOrder(
  securityLevelId: string | null | undefined,
  levelsById: Map<string, number>,
): string {
  if (!securityLevelId) return '—'
  const levelOrder = levelsById.get(securityLevelId)
  if (levelOrder == null) return '—'
  return String(levelOrder)
}

const routeApi = getRouteApi('/app/archive-dossiers/$fondId/$dossierId')

function DetailField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}

const detailFieldsGridClassName =
  'grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3'

export function ArchiveWarehouseDossierDetailPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tSecurity } = useTranslation('security-level')
  const queryClient = useQueryClient()
  const { fondId, dossierId } = routeApi.useParams()
  const isUnassigned = isUnassignedWarehouseFondId(fondId)
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const fileId = search.fileId ?? null
  const preferredFileName = search.fileName ?? null
  const highlightPage = search.highlightPage ?? null
  const highlightBbox = search.highlightBbox ?? null
  const singleFileMode = search.singleFile === true && Boolean(fileId)
  const [detailTab, setDetailTab] = useState<'dossier' | 'documents'>(() =>
    singleFileMode ? 'documents' : 'dossier',
  )
  const [accessSecurityLevelId, setAccessSecurityLevelId] = useState<
    string | null
  >(() => getRememberedDossierSecurityLevel(dossierId) ?? null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [pendingLevelId, setPendingLevelId] = useState<string | null>(null)

  const { data: profile } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(profile)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })
  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(profile, rolePermissions?.rules.permissions),
    [profile, rolePermissions?.rules.permissions],
  )
  const canReupload = canReuploadArchiveWarehouse(permissions)
  const canDelete = canDeleteArchiveWarehouse(permissions)
  const canMove = canEditArchiveWarehouse(permissions)
  const canManagePhysical = canManageArchiveWarehousePhysical(permissions)

  const { data, isPending, isError, error } = useQuery(
    archiveWarehouseDossierDetailQueryOptions(dossierId, accessSecurityLevelId),
  )
  const { data: dossierTypesData } = useQuery(
    archiveWarehouseDossierTypesQueryOptions(),
  )
  const { data: documentTypesData } = useQuery(
    archiveWarehouseDocumentTypesQueryOptions(),
  )
  const { data: securityLevelsData } = useQuery(
    activeSecurityLevelsQueryOptions(),
  )
  const securityLevelById = useMemo(() => {
    const map = new Map<string, number>()
    for (const level of securityLevelsData?.items ?? []) {
      map.set(level.id, level.levelOrder)
    }
    return map
  }, [securityLevelsData])

  const passwordRequired = useMemo(
    () => (isError ? getPasswordRequiredFromError(error) : null),
    [error, isError],
  )

  useEffect(() => {
    setAccessSecurityLevelId(getRememberedDossierSecurityLevel(dossierId) ?? null)
    setPasswordDialogOpen(false)
    setPendingLevelId(null)
  }, [dossierId])

  useEffect(() => {
    return () => {
      clearDossierAccessSession(dossierId)
      queryClient.removeQueries({
        queryKey: ['archive-warehouse', 'dossier-detail', dossierId],
      })
    }
  }, [dossierId, queryClient])

  useEffect(() => {
    if (!data?.dossier) return
    rememberDossierSecurityLevel(dossierId, data.dossier.securityLevelId)
    if (data.dossier.securityLevelId) {
      setAccessSecurityLevelId(data.dossier.securityLevelId)
    }
  }, [data?.dossier, dossierId])

  useEffect(() => {
    if (!passwordRequired || passwordRequired.scope !== 'level') return
    const levelId =
      passwordRequired.securityLevelId ??
      accessSecurityLevelId ??
      getRememberedDossierSecurityLevel(dossierId) ??
      null
    if (!levelId) return
    if (getSecurityLevelAccessToken(levelId)) return
    setPendingLevelId(levelId)
    setPasswordDialogOpen(true)
  }, [accessSecurityLevelId, dossierId, passwordRequired])

  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!pendingLevelId) {
        throw new Error(tSecurity('access.unlockFailed'))
      }
      return verifySecurityLevelAccess({
        securityLevelId: pendingLevelId,
        password,
      })
    },
    onSuccess: async (result) => {
      const unlockedLevelId = pendingLevelId
      if (!unlockedLevelId) return
      setSecurityLevelAccessToken(
        unlockedLevelId,
        result.token,
        result.expiresIn,
      )
      rememberDossierUnlockedSecurityLevel(dossierId, unlockedLevelId)
      rememberDossierSecurityLevel(dossierId, unlockedLevelId)
      setAccessSecurityLevelId(unlockedLevelId)
      setPasswordDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
      try {
        await queryClient.fetchQuery(
          archiveWarehouseDossierDetailQueryOptions(
            dossierId,
            unlockedLevelId,
          ),
        )
      } catch (err) {
        toast.error(translateError(err) || tSecurity('access.unlockFailed'))
      }
    },
    onError: (err) => {
      toast.error(translateError(err) || tSecurity('access.unlockFailed'))
    },
  })

  const listLabel = useMemo(() => {
    if (search.browseView === 'dossierTypes' && search.dossierTypeId) {
      const typeName =
        dossierTypesData?.items.find((item) => item.id === search.dossierTypeId)
          ?.name ?? search.dossierTypeId
      return t('page.dossierTypeDossiersTitle', { name: typeName })
    }
    if (search.browseView === 'documentTypes' && search.documentTypeId) {
      const typeName =
        documentTypesData?.items.find(
          (item) => item.id === search.documentTypeId,
        )?.name ?? search.documentTypeId
      return t('page.documentTypeDocumentsTitle', { name: typeName })
    }
    if (isUnassigned) {
      return t('page.unassignedDossiersTitle')
    }
    return data?.dossier.fondName ?? fondId
  }, [
    data?.dossier.fondName,
    documentTypesData?.items,
    dossierTypesData?.items,
    fondId,
    isUnassigned,
    search.browseView,
    search.documentTypeId,
    search.dossierTypeId,
    t,
  ])

  function navigateAfterDossierLeftWarehouse() {
    if (search.browseView === 'documentTypes' && search.documentTypeId) {
      void navigate({
        to: '/app/archive-dossiers/by-document-type/$documentTypeId',
        params: { documentTypeId: search.documentTypeId },
      })
      return
    }
    if (search.browseView === 'dossierTypes' && search.dossierTypeId) {
      void navigate({
        to: '/app/archive-dossiers/by-dossier-type/$dossierTypeId',
        params: { dossierTypeId: search.dossierTypeId },
      })
      return
    }
    if (isUnassigned) {
      void navigate({
        to: '/app/archive-warehouse',
        search: { tab: 'dossiers', browseView: 'unassigned' },
      })
      return
    }
    void navigate({
      to: '/app/archive-dossiers/$fondId',
      params: { fondId },
    })
  }

  const breadcrumbSegments = useMemo(() => {
    if (!data?.dossier.name) return []
    return buildSimplifiedBrowseBreadcrumbSegments({
      listLabel,
      dossierName: data.dossier.name,
      onNavigateList: navigateAfterDossierLeftWarehouse,
    })
  }, [data?.dossier.name, listLabel, navigateAfterDossierLeftWarehouse])

  const sortedFields = useMemo(() => {
    const fields = data?.archiveSubmission?.fieldConfigSnapshot?.fields ?? []
    return [...fields].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [data?.archiveSubmission?.fieldConfigSnapshot?.fields])

  const visibleFiles = useMemo(() => {
    if (!data?.files) return []
    if (!singleFileMode || !fileId) return data.files
    return data.files.filter((file) => file.id === fileId)
  }, [data?.files, fileId, singleFileMode])

  function navigateBackToDossierList() {
    navigateAfterDossierLeftWarehouse()
  }

  return (
    <ArchiveWarehouseDataShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <ArchiveWarehouseDrillDownHeader
          segments={
            breadcrumbSegments.length > 0
              ? breadcrumbSegments
              : [{ label: data?.dossier.name ?? t('detail.loading') }]
          }
          onBack={navigateBackToDossierList}
          backAriaLabel={t('detail.backToList')}
        />

        {isPending ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {isError ? (
          <Card className="border-destructive p-8 text-center text-sm text-destructive">
            {passwordRequired?.scope === 'level' ? (
              <div className="space-y-3">
                <p>{tSecurity('access.levelDescription')}</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const levelId =
                      passwordRequired.securityLevelId ??
                      pendingLevelId ??
                      accessSecurityLevelId
                    if (levelId) {
                      setPendingLevelId(levelId)
                      setPasswordDialogOpen(true)
                    }
                  }}
                >
                  {tSecurity('access.verify')}
                </Button>
              </div>
            ) : error instanceof Error ? (
              translateError(error)
            ) : (
              t('errors.detailFailed')
            )}
          </Card>
        ) : null}

        {data ? (
          <ArchiveWarehouseFileViewer
            dossierId={data.dossier.id}
            fondId={data.dossier.fondId ?? fondId}
            files={visibleFiles}
            currentMetadataUrl={data.currentMetadataUrl}
            selectedFileId={fileId}
            preferredFileName={preferredFileName}
            highlightPage={highlightPage}
            highlightBbox={highlightBbox}
            singleFileMode={singleFileMode}
            onSelectFile={(nextFileId) => {
              void navigate({
                search: (prev) => ({ ...prev, fileId: nextFileId }),
                replace: true,
              })
            }}
            canReupload={canReupload}
            canDelete={canDelete}
            canMove={canMove}
            metadataViewAccess={data.metadataViewAccess ?? {}}
            onDossierLeftWarehouse={navigateAfterDossierLeftWarehouse}
          >
            <Tabs
              value={detailTab}
              onValueChange={(value) => {
                if (value === 'dossier' || value === 'documents') {
                  setDetailTab(value)
                }
              }}
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden"
            >
              <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
                <TabsList className="mb-0 flex h-auto w-auto shrink-0 items-end justify-start gap-1 border-0 bg-transparent p-0">
                  <TabsTrigger
                    value="dossier"
                    className={warehouseSubTabsTriggerClassName}
                  >
                    <FolderOpen className="size-3.5 shrink-0" aria-hidden />
                    {t('detail.dossierInfo')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className={warehouseSubTabsTriggerClassName}
                  >
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    {t('detail.documentInfo')}
                  </TabsTrigger>
                </TabsList>
                {detailTab === 'documents' && !singleFileMode ? (
                  <ArchiveWarehouseFileViewerToolbar />
                ) : null}
              </div>

              <TabsContent
                value="dossier"
                className="mt-0 min-h-0 min-w-0 overflow-y-auto"
              >
                <Card className="divide-y divide-border p-3">
                  <section className="space-y-2 pb-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {t('detail.dossierInfo')}
                    </h3>
                    <dl className={detailFieldsGridClassName}>
                      <DetailField label={t('table.fond')}>
                        {data.dossier.fondName ?? '—'}
                      </DetailField>
                      <DetailField label={t('table.dossierType')}>
                        {data.dossier.dossierTypeName ?? '—'}
                      </DetailField>
                      <DetailField label={t('table.path')}>
                        <span className="break-all">
                          {data.dossier.folderPath ?? '—'}
                        </span>
                      </DetailField>
                      <DetailField label={t('table.archivedAt')}>
                        {data.dossier.archivedAt
                          ? formatDate(
                              data.dossier.archivedAt,
                              'P',
                              i18n.language,
                            )
                          : '—'}
                      </DetailField>
                      <DetailField label={t('table.archiveStorageState')}>
                        <Badge variant="outline" className="font-normal">
                          {t(
                            `archiveStorageState.${data.dossier.archiveStorageState}`,
                          )}
                        </Badge>
                      </DetailField>
                      <DetailField label={t('detail.securityLevel')}>
                        {formatSecurityLevelOrder(
                          data.dossier.securityLevelId,
                          securityLevelById,
                        )}
                      </DetailField>
                      <DetailField label={t('filters.year')}>
                        {data.dossier.archiveYear ?? '—'}
                      </DetailField>
                      <DetailField label={t('detail.effectiveRetention')}>
                        {data.dossier.effectiveRetentionPeriodName ?? '—'}
                      </DetailField>
                      <DetailField label={t('stats.storageSize')}>
                        {formatFileSize(data.dossier.totalSizeKb * 1024)}
                      </DetailField>
                    </dl>
                  </section>

                  <div className="py-3">
                    <DossierPhysicalLocationSection
                      dossierId={data.dossier.id}
                      dossierName={data.dossier.name}
                      canManage={canManagePhysical}
                    />
                  </div>

                  {data.archiveSubmission ? (
                    <section className="space-y-2 pt-3">
                      <h3 className="text-sm font-medium text-foreground">
                        {t('detail.archiveMetadata')}
                      </h3>
                      <dl className={detailFieldsGridClassName}>
                        {sortedFields.map((field) => (
                          <DetailField key={field.id} label={field.label}>
                            {formatArchiveFieldDisplay(
                              field,
                              data.archiveSubmission?.fieldValues[
                                field.fieldKey
                              ],
                              data.archiveSubmission?.fieldConfigSnapshot
                                ?.resolvedLabels,
                            )}
                          </DetailField>
                        ))}
                      </dl>
                    </section>
                  ) : null}
                </Card>
              </TabsContent>

              <TabsContent
                value="documents"
                className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <ArchiveWarehouseFileViewerPanels />
              </TabsContent>
            </Tabs>
          </ArchiveWarehouseFileViewer>
        ) : null}

        <SecurityAccessPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          title={tSecurity('access.levelTitle')}
          description={tSecurity('access.levelDescription')}
          isPending={unlockMutation.isPending}
          onSubmit={async (password) => {
            await unlockMutation.mutateAsync(password)
          }}
        />
      </div>
    </ArchiveWarehouseDataShell>
  )
}
