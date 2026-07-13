import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { archiveWarehouseDossierDetailQueryOptions } from '@/features/archive-warehouse/queries'
import { formatArchiveFieldDisplay } from '@/features/archive-warehouse/lib/formatArchiveFieldDisplay'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

type ArchiveWarehouseDossierDetailDrawerProps = {
  dossierId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchiveWarehouseDossierDetailDrawer({
  dossierId,
  open,
  onOpenChange,
}: ArchiveWarehouseDossierDetailDrawerProps) {
  const { t, i18n } = useTranslation('archive-warehouse')

  const { data, isPending, isError, error } = useQuery(
    archiveWarehouseDossierDetailQueryOptions(open ? dossierId : null),
  )

  const sortedFields = useMemo(() => {
    const fields = data?.archiveSubmission?.fieldConfigSnapshot.fields ?? []
    return [...fields].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [data?.archiveSubmission?.fieldConfigSnapshot.fields])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('detail.title')}</SheetTitle>
          <SheetDescription>{data?.dossier.name ?? t('detail.loading')}</SheetDescription>
        </SheetHeader>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-lg border border-destructive bg-card p-4 text-sm text-destructive">
            {error instanceof Error ? translateError(error) : t('errors.detailFailed')}
          </div>
        ) : null}

        {data ? (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{t('detail.dossierInfo')}</h3>
              <dl className="grid gap-2 text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.name')}</dt>
                  <dd>{data.dossier.name}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.fond')}</dt>
                  <dd>{data.dossier.fondName ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.path')}</dt>
                  <dd className="break-all">{data.dossier.folderPath ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.archivedAt')}</dt>
                  <dd>
                    {data.dossier.archivedAt
                      ? formatDate(data.dossier.archivedAt, 'PPp', i18n.language)
                      : '—'}
                  </dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('filters.year')}</dt>
                  <dd>{data.dossier.archiveYear ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="text-muted-foreground">{t('table.documentCount')}</dt>
                  <dd>{data.dossier.documentCount}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
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
                <dl className="grid gap-2 text-sm">
                  {sortedFields.map((field) => (
                    <div key={field.id} className="grid grid-cols-[140px_1fr] gap-2">
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

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{t('detail.files')}</h3>
              {data.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noFiles')}</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('detail.fileName')}</TableHead>
                        <TableHead>{t('detail.fileSize')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell>{file.fileName}</TableCell>
                          <TableCell>
                            {formatFileSize((file.fileSizeKb ?? 0) * 1024)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
