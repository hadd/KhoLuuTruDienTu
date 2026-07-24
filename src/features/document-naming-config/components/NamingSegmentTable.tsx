import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createEmptySegment,
  DATE_SEGMENT_SOURCE_VALUES,
  DOSSIER_SEGMENT_SOURCE_VALUES,
  FILE_SEGMENT_SOURCE_VALUES,
  getSegmentFieldError,
  moveSegment,
  type NamingSegmentFieldErrorT,
} from '@/features/document-naming-config/schemas'
import type {
  DocumentNamingFieldCatalogT,
  DocumentNamingSegmentSourceT,
  DocumentNamingSegmentT,
  DocumentNamingTargetTypeT,
} from '@/features/document-naming-config/types'
import { cn } from '@/lib/utils/cn'

interface NamingSegmentTableProps {
  segments: Array<DocumentNamingSegmentT>
  fieldCatalog: DocumentNamingFieldCatalogT
  title: string
  targetType: DocumentNamingTargetTypeT
  disabled?: boolean
  errors?: Array<NamingSegmentFieldErrorT>
  onChange: (segments: Array<DocumentNamingSegmentT>) => void
}

const SOURCE_OPTIONS_BY_TARGET = {
  dossier: DOSSIER_SEGMENT_SOURCE_VALUES,
  file: FILE_SEGMENT_SOURCE_VALUES,
} as const

function needsValue(source: DocumentNamingSegmentSourceT): boolean {
  return source === 'fixed' || source === 'auto_increment'
}

function needsFieldKey(source: DocumentNamingSegmentSourceT): boolean {
  return (
    source === 'fond_field' ||
    source === 'dossier_field' ||
    source === 'file_field'
  )
}

function isDateSource(
  source: DocumentNamingSegmentSourceT,
): source is (typeof DATE_SEGMENT_SOURCE_VALUES)[number] {
  return DATE_SEGMENT_SOURCE_VALUES.includes(
    source as (typeof DATE_SEGMENT_SOURCE_VALUES)[number],
  )
}

function getFieldOptions(
  source: DocumentNamingSegmentSourceT,
  fieldCatalog: DocumentNamingFieldCatalogT,
) {
  if (source === 'fond_field') return fieldCatalog.fond
  if (source === 'dossier_field') return fieldCatalog.dossier
  if (source === 'file_field') return fieldCatalog.file
  return []
}

function getCurrentDateValue(source: DocumentNamingSegmentSourceT): string {
  const now = new Date()
  const lowerSource = source.toLowerCase()

  if (lowerSource.includes('year')) {
    return String(now.getFullYear())
  }
  if (lowerSource.includes('month')) {
    return String(now.getMonth() + 1).padStart(2, '0')
  }
  if (lowerSource.includes('day')) {
    return String(now.getDate()).padStart(2, '0')
  }

  return now.toLocaleDateString('vi-VN')
}

export function NamingSegmentTable({
  segments,
  fieldCatalog,
  title,
  targetType,
  disabled = false,
  errors = [],
  onChange,
}: NamingSegmentTableProps) {
  const { t } = useTranslation('document-naming-config')
  const sourceOptions = SOURCE_OPTIONS_BY_TARGET[targetType]

  const updateSegment = (index: number, patch: Partial<DocumentNamingSegmentT>) => {
    onChange(
      segments.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...patch } : segment,
      ),
    )
  }

  const removeSegment = (index: number) => {
    onChange(segments.filter((_, segmentIndex) => segmentIndex !== index))
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...segments, createEmptySegment()])}
        >
          <Plus className="size-4" aria-hidden />
          {t('segments.add')}
        </Button>
      </div>

      {segments.length === 0 ? (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{t('segments.empty')}</p>
          {getSegmentFieldError(errors, -1, 'segments') ? (
            <p className="text-sm text-destructive">
              {getSegmentFieldError(errors, -1, 'segments')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <Table className="table-fixed w-full">
            <colgroup>
              <col className="w-[72px]" />
              <col className="w-[96px]" />
              <col className="w-[200px]" />
              <col />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>{t('segments.columns.position')}</TableHead>
                <TableHead>{t('segments.columns.length')}</TableHead>
                <TableHead>{t('segments.columns.source')}</TableHead>
                <TableHead>{t('segments.columns.value')}</TableHead>
                <TableHead>{t('segments.columns.padChar')}</TableHead>
                <TableHead className="text-right">
                  {t('segments.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment, index) => {
                const fieldOptions = getFieldOptions(segment.source, fieldCatalog)
                const lengthError = getSegmentFieldError(errors, index, 'length')
                const sourceError = getSegmentFieldError(errors, index, 'source')
                const valueError = getSegmentFieldError(errors, index, 'value')
                const fieldKeyError = getSegmentFieldError(errors, index, 'fieldKey')
                const padCharError = getSegmentFieldError(errors, index, 'padChar')

                return (
                  <TableRow key={`segment-${index}`}>
                    <TableCell className="text-center font-medium tabular-nums">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min={1}
                          max={64}
                          className={cn('w-full', lengthError && 'border-destructive')}
                          value={segment.length}
                          disabled={disabled}
                          onChange={(event) =>
                            updateSegment(index, {
                              length: Number.parseInt(event.target.value, 10) || 1,
                            })
                          }
                        />
                        {lengthError ? (
                          <p className="text-xs text-destructive">{lengthError}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Select
                          value={segment.source}
                          disabled={disabled}
                          onValueChange={(value) => {
                            const source = value as DocumentNamingSegmentSourceT
                            updateSegment(index, {
                              source,
                              value:
                                source === 'auto_increment'
                                  ? '1'
                                  : source === 'fixed'
                                    ? ''
                                    : null,
                              fieldKey: null,
                            })
                          }}
                        >
                          <SelectTrigger
                            className={cn('w-full', sourceError && 'border-destructive')}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceOptions.map((source) => (
                              <SelectItem key={source} value={source}>
                                {t(`segments.sources.${source}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {sourceError ? (
                          <p className="text-xs text-destructive">{sourceError}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="h-9 w-full">
                          {needsValue(segment.source) ? (
                            segment.source === 'auto_increment' ? (
                              <Input
                                type="number"
                                min={1}
                                className={cn('h-9 w-full', valueError && 'border-destructive')}
                                value={segment.value ?? ''}
                                disabled={disabled}
                                placeholder={t('segments.autoIncrementPlaceholder')}
                                onChange={(event) =>
                                  updateSegment(index, {
                                    value: String(
                                      Number.parseInt(event.target.value, 10) || 1,
                                    ),
                                  })
                                }
                              />
                            ) : (
                              <Input
                                className={cn('h-9 w-full', valueError && 'border-destructive')}
                                value={segment.value ?? ''}
                                disabled={disabled}
                                placeholder={t('segments.fixedPlaceholder')}
                                onChange={(event) =>
                                  updateSegment(index, { value: event.target.value })
                                }
                              />
                            )
                          ) : needsFieldKey(segment.source) ? (
                            <Select
                              value={segment.fieldKey ?? ''}
                              disabled={disabled}
                              onValueChange={(value) =>
                                updateSegment(index, { fieldKey: value })
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-9 w-full',
                                  fieldKeyError && 'border-destructive',
                                )}
                              >
                                <SelectValue placeholder={t('segments.selectField')} />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldOptions.map((field) => (
                                  <SelectItem key={field.key} value={field.key}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : isDateSource(segment.source) ? (
                            <div className="flex h-9 items-center text-sm text-muted-foreground">
                              {getCurrentDateValue(segment.source)}
                            </div>
                          ) : (
                            <div className="flex h-9 items-center text-sm text-muted-foreground">
                              —
                            </div>
                          )}
                        </div>
                        {valueError || fieldKeyError ? (
                          <p className="text-xs text-destructive">
                            {valueError ?? fieldKeyError}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          className={cn('w-full', padCharError && 'border-destructive')}
                          value={segment.padChar ?? ''}
                          maxLength={1}
                          disabled={disabled}
                          placeholder={t('segments.padCharPlaceholder')}
                          onChange={(event) =>
                            updateSegment(index, {
                              padChar: event.target.value || null,
                            })
                          }
                        />
                        {padCharError ? (
                          <p className="text-xs text-destructive">{padCharError}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled || index === 0}
                          onClick={() =>
                            onChange(moveSegment(segments, index, index - 1))
                          }
                          aria-label={t('segments.moveUp')}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled || index === segments.length - 1}
                          onClick={() =>
                            onChange(moveSegment(segments, index, index + 1))
                          }
                          aria-label={t('segments.moveDown')}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={disabled}
                          className={cn(
                            'text-destructive hover:bg-destructive/10 hover:text-destructive',
                          )}
                          onClick={() => removeSegment(index)}
                          aria-label={t('segments.remove')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
