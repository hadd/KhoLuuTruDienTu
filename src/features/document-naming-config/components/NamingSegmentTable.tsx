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
  moveSegment,
  SEGMENT_ALIGN_VALUES,
  SEGMENT_SOURCE_VALUES,
} from '@/features/document-naming-config/schemas'
import type {
  DocumentNamingFieldCatalogT,
  DocumentNamingSegmentSourceT,
  DocumentNamingSegmentT,
} from '@/features/document-naming-config/types'

interface NamingSegmentTableProps {
  segments: Array<DocumentNamingSegmentT>
  fieldCatalog: DocumentNamingFieldCatalogT
  disabled?: boolean
  onChange: (segments: Array<DocumentNamingSegmentT>) => void
}

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

function getFieldOptions(
  source: DocumentNamingSegmentSourceT,
  fieldCatalog: DocumentNamingFieldCatalogT,
) {
  if (source === 'fond_field') return fieldCatalog.fond
  if (source === 'dossier_field') return fieldCatalog.dossier
  if (source === 'file_field') return fieldCatalog.file
  return []
}

export function NamingSegmentTable({
  segments,
  fieldCatalog,
  disabled = false,
  onChange,
}: NamingSegmentTableProps) {
  const { t } = useTranslation('document-naming-config')

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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{t('segments.title')}</p>
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
        <p className="text-sm text-muted-foreground">{t('segments.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">{t('segments.columns.index')}</TableHead>
                <TableHead className="w-24">{t('segments.columns.length')}</TableHead>
                <TableHead className="min-w-40">{t('segments.columns.source')}</TableHead>
                <TableHead className="min-w-36">{t('segments.columns.value')}</TableHead>
                <TableHead className="w-32">{t('segments.columns.align')}</TableHead>
                <TableHead className="w-28">{t('segments.columns.padChar')}</TableHead>
                <TableHead className="w-28 text-right">
                  {t('segments.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment, index) => {
                const fieldOptions = getFieldOptions(segment.source, fieldCatalog)

                return (
                  <TableRow key={`segment-${index}`}>
                    <TableCell className="font-medium">
                      {t('segments.segmentNumber', { number: index + 1 })}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={64}
                        value={segment.length}
                        disabled={disabled}
                        onChange={(event) =>
                          updateSegment(index, {
                            length: Number.parseInt(event.target.value, 10) || 0,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={segment.source}
                        disabled={disabled}
                        onValueChange={(value) =>
                          updateSegment(index, {
                            source: value as DocumentNamingSegmentSourceT,
                            value: null,
                            fieldKey: null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEGMENT_SOURCE_VALUES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {t(`segments.sources.${source}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {needsValue(segment.source) ? (
                        <Input
                          value={segment.value ?? ''}
                          disabled={disabled}
                          placeholder={
                            segment.source === 'auto_increment'
                              ? t('segments.autoIncrementPlaceholder')
                              : t('segments.fixedPlaceholder')
                          }
                          onChange={(event) =>
                            updateSegment(index, { value: event.target.value })
                          }
                        />
                      ) : needsFieldKey(segment.source) ? (
                        <Select
                          value={segment.fieldKey ?? ''}
                          disabled={disabled}
                          onValueChange={(value) =>
                            updateSegment(index, { fieldKey: value })
                          }
                        >
                          <SelectTrigger>
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
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
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
