import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EXPORT_SEPARATOR_OPTIONS,
  fieldCatalogToGroups,
  fieldLabel,
  isFieldAssignedToOtherColumn,
  moveColumn,
  moveFieldInColumn,
  toggleFieldAcrossColumns,
  toggleFieldInColumn,
  type MetadataExportColumnErrors,
} from '@/features/data-config/lib/metadataExportHelpers'
import type {
  MetadataExportColumnConfigT,
  MetadataExportFieldCatalogItemT,
} from '@/features/data-config/types'
import { cn } from '@/lib/utils/cn'

interface MetadataExportColumnEditorProps {
  columns: Array<MetadataExportColumnConfigT>
  fieldCatalog: Array<MetadataExportFieldCatalogItemT>
  disabled?: boolean
  columnErrors?: MetadataExportColumnErrors
  onChange: (columns: Array<MetadataExportColumnConfigT>) => void
}

export function MetadataExportColumnEditor({
  columns,
  fieldCatalog,
  disabled = false,
  columnErrors = {},
  onChange,
}: MetadataExportColumnEditorProps) {
  const { t } = useTranslation('data-config')
  const groups = fieldCatalogToGroups(fieldCatalog)

  const updateColumn = (
    index: number,
    patch: Partial<MetadataExportColumnConfigT>,
  ) => {
    onChange(
      columns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column,
      ),
    )
  }

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, columnIndex) => columnIndex !== index))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t('metadataExport.columnsTitle')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...columns,
              { header: '', fieldKeys: [], separator: ', ' },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {t('metadataExport.addColumn')}
        </Button>
      </div>

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('metadataExport.emptyColumns')}
        </p>
      ) : null}

      {columns.map((column, columnIndex) => {
        const errors = columnErrors[columnIndex]

        return (
        <div
          key={`column-${columnIndex}`}
          data-export-column-index={columnIndex}
          className={cn(
            'rounded-lg border bg-card p-4',
            errors ? 'border-destructive' : 'border-border',
          )}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t('metadataExport.columnNumber', { number: columnIndex + 1 })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || columnIndex === 0}
                onClick={() =>
                  onChange(moveColumn(columns, columnIndex, columnIndex - 1))
                }
                aria-label={t('metadataExport.moveColumnUp')}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || columnIndex === columns.length - 1}
                onClick={() =>
                  onChange(moveColumn(columns, columnIndex, columnIndex + 1))
                }
                aria-label={t('metadataExport.moveColumnDown')}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => removeColumn(columnIndex)}
                aria-label={t('metadataExport.removeColumn')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('metadataExport.headerLabel')}</Label>
              <Input
                data-export-column-header
                value={column.header}
                disabled={disabled}
                placeholder={t('metadataExport.headerPlaceholder')}
                aria-invalid={Boolean(errors?.missingHeader || errors?.duplicateHeader)}
                className={cn(
                  (errors?.missingHeader || errors?.duplicateHeader) &&
                    'border-destructive',
                )}
                onChange={(event) =>
                  updateColumn(columnIndex, { header: event.target.value })
                }
              />
              {errors?.missingHeader ? (
                <p className="text-xs text-destructive">
                  {t('metadataExport.validation.missingHeaderInline')}
                </p>
              ) : null}
              {errors?.duplicateHeader ? (
                <p className="text-xs text-destructive">
                  {t('metadataExport.validation.duplicateHeaderInline')}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>{t('metadataExport.separatorLabel')}</Label>
              <Select
                value={column.separator}
                disabled={disabled}
                onValueChange={(value) =>
                  updateColumn(columnIndex, { separator: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPORT_SEPARATOR_OPTIONS.map((option) => (
                    <SelectItem key={option.labelKey} value={option.value}>
                      {t(`metadataExport.separators.${option.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className="mt-4 space-y-2"
            data-export-column-fields
            tabIndex={-1}
          >
            <Label>{t('metadataExport.fieldsLabel')}</Label>
            {errors?.missingFields ? (
              <p className="text-xs text-destructive">
                {t('metadataExport.validation.missingFieldsInline')}
              </p>
            ) : null}
            {column.fieldKeys.length > 0 ? (
              <ul className="mb-3 space-y-1 rounded-md border border-border p-2">
                {column.fieldKeys.map((fieldKey, fieldIndex) => (
                  <li
                    key={`${columnIndex}-${fieldKey}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">
                      {fieldLabel(fieldCatalog, fieldKey)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled || fieldIndex === 0}
                        onClick={() =>
                          updateColumn(
                            columnIndex,
                            moveFieldInColumn(column, fieldIndex, fieldIndex - 1),
                          )
                        }
                        aria-label={t('metadataExport.moveFieldUp')}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={
                          disabled || fieldIndex === column.fieldKeys.length - 1
                        }
                        onClick={() =>
                          updateColumn(
                            columnIndex,
                            moveFieldInColumn(column, fieldIndex, fieldIndex + 1),
                          )
                        }
                        aria-label={t('metadataExport.moveFieldDown')}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() =>
                          updateColumn(
                            columnIndex,
                            toggleFieldInColumn(column, fieldKey, false),
                          )
                        }
                        aria-label={t('metadataExport.removeField')}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('metadataExport.noFieldsInColumn')}
              </p>
            )}

            <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('metadataExport.noFieldCatalog')}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.groupCode}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.groupName}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.fields.map((field) => {
                        const checked = column.fieldKeys.includes(field.key)
                        const assignedElsewhere = isFieldAssignedToOtherColumn(
                          columns,
                          columnIndex,
                          field.key,
                        )
                        const isDisabled = disabled || (assignedElsewhere && !checked)

                        return (
                          <button
                            key={field.key}
                            type="button"
                            disabled={isDisabled}
                            title={
                              assignedElsewhere && !checked
                                ? t('metadataExport.fieldAssignedElsewhere')
                                : undefined
                            }
                            onClick={() =>
                              onChange(
                                toggleFieldAcrossColumns(
                                  columns,
                                  columnIndex,
                                  field.key,
                                  !checked,
                                ),
                              )
                            }
                            className={cn(
                              'rounded-md border px-2 py-1 text-xs transition-colors',
                              checked
                                ? 'border-primary bg-primary/10 text-primary'
                                : assignedElsewhere
                                  ? 'cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-60'
                                  : 'border-border bg-background hover:bg-muted/50',
                            )}
                          >
                            {field.display}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}
