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

// Định nghĩa hàm hiển thị giá trị ô
const renderCellValue = (value: unknown, mode?: 'structure' | 'data') => {
  if (typeof value !== 'string') return value

  // Trong chế độ cấu trúc, luôn tách chuỗi và áp dụng whitespace-nowrap cho mọi trường (kể cả chỉ có 1 trường)
  if (mode === 'structure') {
    const items = value.split(', ')
    return (
      <div className="flex flex-col gap-1 text-left">
        {items.map((item, index) => (
          <span key={index} className="block whitespace-nowrap">
            {item}
          </span>
        ))}
      </div>
    )
  }

  return <span className="whitespace-pre-line">{value}</span>
}

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
              {row.cells.map((cell, cellIndex) => {
                const isStructure = mode === 'structure'
                const isHeaderRow = row.rowLabel === 'headerRow'
                const isFieldsRow = row.rowLabel === 'fieldsRow'

                return (
                  <TableCell
                    key={`${rowIndex}-${cellIndex}`}
                    className={`align-top ${
                      isStructure
                        ? isHeaderRow
                          ? 'w-px min-w-0 whitespace-normal break-words' // Ép tiêu đề cột tự động xuống dòng ôm theo trường
                          : 'min-w-[100px]' // Cột co giãn tự nhiên theo trường
                        : 'max-w-xs whitespace-pre-wrap'
                    }`}
                  >
                    {isStructure && isFieldsRow ? (
                      cell ? (
                        <div className="text-muted-foreground italic">
                          {renderCellValue(cell, mode)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    ) : (
                      cell || '—'
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}