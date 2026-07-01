import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MetadataExportPreviewResultT } from '@/features/data-management/api/dossierClient'

interface MetadataExportPreviewTableProps {
  preview: MetadataExportPreviewResultT
  mode?: 'structure' | 'data'
}

const STRUCTURE_ROW_LABEL_KEYS = {
  headerRow: 'recordDetail.metadataExportPreview.headerRowLabel',
  fieldsRow: 'recordDetail.metadataExportPreview.fieldsRowLabel',
} as const

export function MetadataExportPreviewTable({
  preview,
  mode = 'structure',
}: MetadataExportPreviewTableProps) {
  const { t } = useTranslation('data-management')

  if (preview.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('recordDetail.metadataExportPreview.empty')}
      </p>
    )
  }

  function resolveRowLabel(rowLabel: string): string {
    if (mode !== 'structure') {
      return rowLabel
    }
    const key =
      STRUCTURE_ROW_LABEL_KEYS[
        rowLabel as keyof typeof STRUCTURE_ROW_LABEL_KEYS
      ]
    return key ? t(key) : rowLabel
  }

  return (
    <div className="space-y-2">
      {mode === 'data' && preview.totalCount > preview.previewCount ? (
        <p className="text-xs text-muted-foreground">
          {t('recordDetail.metadataExportPreview.truncatedHint', {
            previewCount: preview.previewCount,
            totalCount: preview.totalCount,
          })}
        </p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-28 bg-card">
              {mode === 'structure'
                ? ''
                : t('recordDetail.metadataExportPreview.rowLabel')}
            </TableHead>
            {preview.headers.map((header, index) => (
              <TableHead key={`${header}-${index}`} className="text-center">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row, rowIndex) => (
            <TableRow key={`${row.rowLabel}-${rowIndex}`}>
              <TableCell className="sticky left-0 z-10 bg-card font-medium">
                {resolveRowLabel(row.rowLabel)}
              </TableCell>
              {row.cells.map((cell, cellIndex) => (
                <TableCell
                  key={`${rowIndex}-${cellIndex}`}
                  className="max-w-xs whitespace-pre-wrap align-top"
                >
                  {mode === 'structure' && row.rowLabel === 'fieldsRow' ? (
                    cell ? (
                      <span className="text-muted-foreground italic">{cell}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  ) : (
                    cell || '—'
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
