import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArchiveWarehouseFileViewer } from '@/features/archive-warehouse/components/ArchiveWarehouseFileViewer'
import { formatArchiveFieldDisplay } from '@/features/archive-warehouse/lib/formatArchiveFieldDisplay'
import { archiveWarehouseDossierDetailQueryOptions } from '@/features/archive-warehouse/queries'
import { getPermissionsFromUser } from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/$fondId/$dossierId')

export function ArchiveWarehouseDossierDetailPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { fondId, dossierId } = routeApi.useParams()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const fileId = search.fileId ?? null
  const preferredFileName = search.fileName ?? null
  const highlightPage = search.highlightPage ?? null
  const highlightBbox = search.highlightBbox ?? null

  const { data: profile } = useQuery(profileQueryOptions)
  const permissions = useMemo(() => getPermissionsFromUser(profile), [profile])
  const hasManage = isPermissionGranted(
    permissions,
    'archive.warehouse.manage',
    'archive.warehouse',
  )
  const canReupload =
    hasManage ||
    isPermissionGranted(
      permissions,
      'archive.warehouse.reupload',
      'archive.warehouse',
    )
  const canDelete =
    hasManage ||
    isPermissionGranted(
      permissions,
      'archive.warehouse.delete',
      'archive.warehouse',
    )
  const canMove =
    hasManage ||
    isPermissionGranted(
      permissions,
      'archive.warehouse.edit',
      'archive.warehouse',
    )

  const { data, isPending, isError, error } = useQuery(
    archiveWarehouseDossierDetailQueryOptions(dossierId),
  )

  const sortedFields = useMemo(() => {
    const fields = data?.archiveSubmission?.fieldConfigSnapshot.fields ?? []
    return [...fields].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [data?.archiveSubmission?.fieldConfigSnapshot.fields])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/app/archive-dossiers/$fondId"
            params={{ fondId }}
          >
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            {t('detail.backToList')}
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {data?.dossier.name ?? t('detail.loading')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('detail.title')}</p>
        </div>
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
        <div className="flex flex-col gap-6">
          <Card className="space-y-6 p-4">
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{t('detail.dossierInfo')}</h3>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.name')}</dt>
                  <dd>{data.dossier.name}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.fond')}</dt>
                  <dd>{data.dossier.fondName ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.path')}</dt>
                  <dd className="break-all">{data.dossier.folderPath ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.archivedAt')}</dt>
                  <dd>
                    {data.dossier.archivedAt
                      ? formatDate(data.dossier.archivedAt, 'PPp', i18n.language)
                      : '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('filters.year')}</dt>
                  <dd>{data.dossier.archiveYear ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('stats.storageSize')}</dt>
                  <dd>{formatFileSize(data.dossier.totalSizeKb * 1024)}</dd>
                </div>
              </dl>
            </section>

            {data.archiveSubmission ? (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  {t('detail.archiveMetadata')}
                </h3>
                <dl className="grid gap-2 text-sm md:grid-cols-2">
                  {sortedFields.map((field) => (
                    <div key={field.id} className="grid grid-cols-[120px_1fr] gap-2">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd>
                        {formatArchiveFieldDisplay(
                          field,
                          data.archiveSubmission?.fieldValues[field.fieldKey],
                          data.archiveSubmission?.fieldConfigSnapshot.resolvedLabels,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </Card>

          <ArchiveWarehouseFileViewer
            dossierId={data.dossier.id}
            fondId={fondId}
            files={data.files}
            currentMetadataUrl={data.currentMetadataUrl}
            selectedFileId={fileId}
            preferredFileName={preferredFileName}
            highlightPage={highlightPage}
            highlightBbox={highlightBbox}
            onSelectFile={(nextFileId) => {
              void navigate({
                search: (prev) => ({ ...prev, fileId: nextFileId }),
                replace: true,
              })
            }}
            canReupload={canReupload}
            canDelete={canDelete}
            canMove={canMove}
            onDossierLeftWarehouse={() => {
              void navigate({
                to: '/app/archive-dossiers/$fondId',
                params: { fondId },
              })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
