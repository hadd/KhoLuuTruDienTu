import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useRouter, useRouterState } from '@tanstack/react-router'
import { FileText, FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DossierPhysicalLocationSection } from '@/features/archive-submission/components/DossierPhysicalLocationSection'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import { ArchiveWarehouseExportDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseExportDialog'
import {
  ArchiveWarehouseFileViewer,
  ArchiveWarehouseFileViewerPanels,
  ArchiveWarehouseFileViewerToolbar,
} from '@/features/archive-warehouse/components/ArchiveWarehouseFileViewer'
import { ArchiveWarehouseSecurityDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseSecurityDialog'
import {
  canDeleteArchiveWarehouse,
  canEditArchiveWarehouse,
  canManageArchiveWarehousePhysical,
  canReuploadArchiveWarehouse,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { buildSimplifiedBrowseBreadcrumbSegments } from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import { formatArchiveFieldDisplay } from '@/features/archive-warehouse/lib/formatArchiveFieldDisplay'
import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierDetailQueryOptions,
  archiveWarehouseDossierTypesQueryOptions,
} from '@/features/archive-warehouse/queries'
import {
  libraryExploitationDocumentTypesQueryOptions,
  libraryExploitationDossierDetailQueryOptions,
  libraryExploitationDossierTypesQueryOptions,
} from '@/features/library/api/exploitation-queries'
import { LibraryPageShell } from '@/features/library/components/LibraryPageShell'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { verifyDossierAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import { getPasswordRequiredFromError } from '@/features/security-level/lib/passwordRequired'
import {
  getDossierAccessToken,
  getRememberedDossierSecurityLevel,
  rememberDossierSecurityLevel,
  setDossierAccessToken,
  type SecurityAccessModule,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import { warehouseSubTabsTriggerClassName } from '@/features/warehouse-management/components/WarehouseManagementBackNav'
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

const defaultRouteApi = getRouteApi('/app/archive-dossiers/$fondId/$dossierId')

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

export interface ArchiveWarehouseDossierDetailPageProps {
  browseMode?: 'warehouse' | 'exploitation'
  routeApi?: any
}

export function ArchiveWarehouseDossierDetailPage({
  browseMode = 'warehouse',
  routeApi: propRouteApi,
}: ArchiveWarehouseDossierDetailPageProps = {}) {
  const activeRouteApi = propRouteApi ?? defaultRouteApi
  const isExploitation = browseMode === 'exploitation'
  const accessModule: SecurityAccessModule = isExploitation
    ? 'exploitation'
    : 'warehouse'
  const { t, i18n } = useTranslation('archive-warehouse')
  const { t: tSecurity } = useTranslation('security-level')
  const queryClient = useQueryClient()
  const { fondId, dossierId } = activeRouteApi.useParams()
  const isUnassigned = isUnassignedWarehouseFondId(fondId)
  const search = activeRouteApi.useSearch()
  const navigate = activeRouteApi.useNavigate()
  const router = useRouter()
  const fromLibraryExploitationList = useRouterState({
    select: (s) =>
      Boolean(
        (s.location.state as { fromLibraryExploitationList?: boolean } | undefined)
          ?.fromLibraryExploitationList,
      ),
  })
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
  >(() => getRememberedDossierSecurityLevel(accessModule, dossierId) ?? null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false)

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
  const canManagePhysical = isExploitation ? false : canManageArchiveWarehousePhysical(permissions)

  const { data, isPending, isError, error } = useQuery(
    isExploitation
      ? libraryExploitationDossierDetailQueryOptions(dossierId)
      : archiveWarehouseDossierDetailQueryOptions(dossierId, accessSecurityLevelId),
  )

  const canReupload = isExploitation
    ? false
    : (data?.actions?.reupload ?? canReuploadArchiveWarehouse(permissions))
  const canDelete = isExploitation
    ? false
    : (data?.actions?.delete ?? canDeleteArchiveWarehouse(permissions))
  const canMove = isExploitation
    ? false
    : (data?.actions?.edit ?? canEditArchiveWarehouse(permissions))
  const disposalCandidateLocked =
    !isExploitation &&
    Boolean(data?.actions) &&
    !data.actions.reupload &&
    !data.actions.delete &&
    !data.actions.edit &&
    (canReuploadArchiveWarehouse(permissions) ||
      canDeleteArchiveWarehouse(permissions) ||
      canEditArchiveWarehouse(permissions))
  const { data: dossierTypesData } = useQuery(
    isExploitation
      ? libraryExploitationDossierTypesQueryOptions()
      : archiveWarehouseDossierTypesQueryOptions(),
  )
  const { data: documentTypesData } = useQuery(
    isExploitation
      ? libraryExploitationDocumentTypesQueryOptions()
      : archiveWarehouseDocumentTypesQueryOptions(),
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

  const allPdfUnlocked =
    !data?.files?.length ||
    data.files.every((file) => !file.accessLocked)
  const canDownload = data?.actions?.download === true
  const downloadDisabled = canDownload && !allPdfUnlocked
  const canConfigureSecurity = data?.actions?.configureSecurity === true

  const passwordRequired = useMemo(
    () => (isError ? getPasswordRequiredFromError(error) : null),
    [error, isError],
  )

  useEffect(() => {
    setAccessSecurityLevelId(
      getRememberedDossierSecurityLevel(accessModule, dossierId) ?? null,
    )
    setPasswordDialogOpen(false)
  }, [accessModule, dossierId])

  useEffect(() => {
    if (!data?.dossier) return
    rememberDossierSecurityLevel(
      accessModule,
      dossierId,
      data.dossier.securityLevelId,
    )
    if (data.dossier.securityLevelId) {
      setAccessSecurityLevelId(data.dossier.securityLevelId)
    }
  }, [accessModule, data?.dossier, dossierId])

  useEffect(() => {
    if (!passwordRequired || passwordRequired.scope !== 'dossier') return
    if (getDossierAccessToken(accessModule, dossierId)) return
    setPasswordDialogOpen(true)
  }, [accessModule, dossierId, passwordRequired])

  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      return verifyDossierAccess({
        dossierId,
        password,
      })
    },
    onSuccess: async (result) => {
      setDossierAccessToken(
        accessModule,
        dossierId,
        result.token,
        result.expiresIn,
      )
      setPasswordDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
      try {
        await queryClient.fetchQuery(
          isExploitation
            ? libraryExploitationDossierDetailQueryOptions(dossierId)
            : archiveWarehouseDossierDetailQueryOptions(
                dossierId,
                accessSecurityLevelId,
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
    if (isExploitation) {
      if (search.browseView === 'documentTypes' && search.documentTypeId) {
        void navigate({
          to: '/app/library/exploitation/by-document-type/$documentTypeId' as any,
          params: { documentTypeId: search.documentTypeId },
        })
        return
      }
      if (search.browseView === 'dossierTypes' && search.dossierTypeId) {
        void navigate({
          to: '/app/library/exploitation/by-dossier-type/$dossierTypeId' as any,
          params: { dossierTypeId: search.dossierTypeId },
        })
        return
      }
      // Prefer history.back so cleared/applied list filters are restored.
      // Do not go via /$fondId — that redirect always re-applies searchFondId.
      if (fromLibraryExploitationList) {
        router.history.back()
        return
      }
      void navigate({
        to: '/app/library/exploitation' as any,
      })
      return
    }

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

  const pageContent = (
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

        {isError && passwordRequired?.scope !== 'dossier' ? (
          <Card className="border-destructive p-8 text-center text-sm text-destructive">
            {error instanceof Error ? translateError(error) : t('errors.detailFailed')}
          </Card>
        ) : null}

        {data ? (
          <>
            {disposalCandidateLocked ? (
              <Card className="border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {t('disposal.candidateWarehouseLockHint')}
              </Card>
            ) : null}
          <ArchiveWarehouseFileViewer
            dossierId={data.dossier.id}
            dossierName={data.dossier.name}
            isExploitation={isExploitation}
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
            canDownload={canDownload}
            downloadDisabled={downloadDisabled}
            onDownload={() => setExportDialogOpen(true)}
            canConfigureSecurity={canConfigureSecurity}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <ArchiveWarehouseFileViewerToolbar />
                  </div>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {formatSecurityLevelOrder(
                              data.dossier.securityLevelId,
                              securityLevelById,
                            )}
                          </span>
                          {canConfigureSecurity ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSecurityDialogOpen(true)}
                            >
                              {t('security.configure')}
                            </Button>
                          ) : null}
                        </div>
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

                  {!isExploitation ? (
                    <div className="py-3">
                      <DossierPhysicalLocationSection
                        dossierId={data.dossier.id}
                        dossierName={data.dossier.name}
                        canManage={canManagePhysical}
                      />
                    </div>
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
          </>
        ) : null}

        <SecurityAccessPasswordDialog
          open={passwordDialogOpen}
          closeOnSubmit={false}
          onOpenChange={(open) => {
            setPasswordDialogOpen(open)
            if (!open) {
              unlockMutation.reset()
              // Nếu đang ở trạng thái lỗi mật khẩu (chưa mở khóa) thì quay về danh sách
              if (isError && passwordRequired?.scope === 'dossier') {
                navigateBackToDossierList()
              }
            }
          }}
          title={tSecurity('access.dossierTitle')}
          description={tSecurity('access.dossierDescription')}
          errorMessage={
            unlockMutation.error
              ? translateError(unlockMutation.error) ||
                tSecurity('access.unlockFailed')
              : undefined
          }
          isPending={unlockMutation.isPending}
          onSubmit={async (password) => {
            await unlockMutation.mutateAsync(password)
          }}
        />

        {data ? (
          <ArchiveWarehouseExportDialog
            open={exportDialogOpen}
            onOpenChange={setExportDialogOpen}
            dossierIds={[data.dossier.id]}
            dossierNames={[data.dossier.name]}
          />
        ) : null}


        {data && canConfigureSecurity ? (
          <ArchiveWarehouseSecurityDialog
            open={securityDialogOpen}
            onOpenChange={setSecurityDialogOpen}
            dossierId={data.dossier.id}
            currentSecurityLevelId={data.dossier.securityLevelId}
            passwordSource={data.dossier.passwordSource ?? 'none'}
          />
        ) : null}
      </div>
  )

  if (isExploitation) {
    return <LibraryPageShell activeTab="exploitation" contentClassName="pb-0 pt-2">{pageContent}</LibraryPageShell>
  }

  return <ArchiveWarehouseDataShell>{pageContent}</ArchiveWarehouseDataShell>
}
