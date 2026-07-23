import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DossierPhysicalLocationSection } from '@/features/archive-submission/components/DossierPhysicalLocationSection'
import { ArchiveWarehouseFileViewer } from '@/features/archive-warehouse/components/ArchiveWarehouseFileViewer'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import {
  canDeleteArchiveWarehouse,
  canEditArchiveWarehouse,
  canManageArchiveWarehousePhysical,
  canReuploadArchiveWarehouse,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { formatArchiveFieldDisplay } from '@/features/archive-warehouse/lib/formatArchiveFieldDisplay'
import { archiveWarehouseDossierDetailQueryOptions } from '@/features/archive-warehouse/queries'
import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

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
  const { fondId, dossierId } = routeApi.useParams()
  const isUnassigned = isUnassignedWarehouseFondId(fondId)
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const fileId = search.fileId ?? null
  const preferredFileName = search.fileName ?? null
  const highlightPage = search.highlightPage ?? null
  const highlightBbox = search.highlightBbox ?? null
  const shellBrowseView =
    search.browseView ?? (isUnassigned ? 'unassigned' : 'fonds')
  const singleFileMode = search.singleFile === true && Boolean(fileId)

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
    archiveWarehouseDossierDetailQueryOptions(dossierId),
  )

  const sortedFields = useMemo(() => {
    const fields = data?.archiveSubmission?.fieldConfigSnapshot?.fields ?? []
    return [...fields].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [data?.archiveSubmission?.fieldConfigSnapshot?.fields])

  const visibleFiles = useMemo(() => {
    if (!data?.files) return []
    if (!singleFileMode || !fileId) return data.files
    return data.files.filter((file) => file.id === fileId)
  }, [data?.files, fileId, singleFileMode])

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

  return (
    <ArchiveWarehouseDataShell
      activeTab="dossiers"
      showBrowseTabs
      browseView={shellBrowseView}
    >
    <div className="flex flex-col gap-3 overflow-y-auto">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">
          {data?.dossier.name ?? t('detail.loading')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('detail.title')}</p>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {isError ? (
        <Card className="border-destructive p-8 text-center text-sm text-destructive">
          {error instanceof Error ? translateError(error) : t('errors.detailFailed')}
        </Card>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-4">
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
                  <span className="break-all">{data.dossier.folderPath ?? '—'}</span>
                </DetailField>
                <DetailField label={t('table.archivedAt')}>
                  {data.dossier.archivedAt
                    ? formatDate(data.dossier.archivedAt, 'P', i18n.language)
                    : '—'}
                </DetailField>
                <DetailField label={t('table.archiveStorageState')}>
                  <Badge variant="outline" className="font-normal">
                    {t(`archiveStorageState.${data.dossier.archiveStorageState}`)}
                  </Badge>
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
                        data.archiveSubmission?.fieldValues[field.fieldKey],
                        data.archiveSubmission?.fieldConfigSnapshot?.resolvedLabels,
                      )}
                    </DetailField>
                  ))}
                </dl>
              </section>
            ) : null}
          </Card>

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
          />
        </div>
      ) : null}
    </div>
    </ArchiveWarehouseDataShell>
  )
}
