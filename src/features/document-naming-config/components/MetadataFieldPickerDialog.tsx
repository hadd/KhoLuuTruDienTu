import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FileText, Folder, Info, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { DocumentNamingMetadataFieldOptionT } from '@/features/document-naming-config/types'
import { cn } from '@/lib/utils/cn'

interface MetadataFieldPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: Array<DocumentNamingMetadataFieldOptionT>
  selectedKey?: string | null
  isFallback?: boolean
  onSelect: (field: DocumentNamingMetadataFieldOptionT) => void
}

export function MetadataFieldPickerDialog({
  open,
  onOpenChange,
  fields,
  selectedKey,
  isFallback = false,
  onSelect,
}: MetadataFieldPickerDialogProps) {
  const { t } = useTranslation('document-naming-config')
  const [search, setSearch] = useState('')

  const [onlyWithValues, setOnlyWithValues] = useState(false)

  const normalizedSearch = search.trim().toLowerCase()

  const fieldsWithValueCount = useMemo(
    () => fields.filter((f) => f.hasValue).length,
    [fields],
  )

  const filteredFields = useMemo(() => {
    let result = fields
    if (!isFallback && onlyWithValues && fieldsWithValueCount > 0) {
      result = result.filter((f) => f.hasValue)
    }
    if (!normalizedSearch) return result
    return result.filter(
      (f) =>
        f.display.toLowerCase().includes(normalizedSearch) ||
        f.fieldName.toLowerCase().includes(normalizedSearch) ||
        f.key.toLowerCase().includes(normalizedSearch),
    )
  }, [fields, isFallback, onlyWithValues, fieldsWithValueCount, normalizedSearch])

  const groupedFields = useMemo(() => {
    const groups: Record<
      string,
      { groupName: string; groupCode: string; items: Array<DocumentNamingMetadataFieldOptionT> }
    > = {}

    for (const field of filteredFields) {
      const code = field.groupCode || 'OTHER'
      if (!groups[code]) {
        groups[code] = {
          groupCode: code,
          groupName:
            field.groupName ||
            (code === 'HO_SO_LUU_TRU'
              ? t('metadataPicker.groupDossier')
              : t('metadataPicker.groupDocument')),
          items: [],
        }
      }
      groups[code].items.push(field)
    }

    return Object.values(groups)
  }, [filteredFields, t])

  const handleSelectField = (field: DocumentNamingMetadataFieldOptionT) => {
    onSelect(field)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-5xl md:max-w-5xl lg:max-w-6xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2.5">
            <Folder className="size-5 text-primary" />
            {t('metadataPicker.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={search}
              placeholder={t('metadataPicker.searchPlaceholder')}
              className="pl-10 pr-9 h-9 text-sm rounded-lg"
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {!isFallback && fieldsWithValueCount > 0 ? (
            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="only-with-values-toggle"
                className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground select-none bg-muted/50 px-2.5 py-1.5 rounded-md border border-border"
              >
                <input
                  id="only-with-values-toggle"
                  type="checkbox"
                  checked={onlyWithValues}
                  onChange={(e) => setOnlyWithValues(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-3.5"
                />
                <span>Chỉ hiện trường có dữ liệu ({fieldsWithValueCount}/{fields.length})</span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="max-h-[560px] min-h-[300px] overflow-y-auto px-6 py-5 space-y-6">
          {isFallback ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 shadow-sm">
              <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span className="leading-relaxed font-medium">
                Hồ sơ chưa có metadata. Đang hiển thị danh mục metadata mẫu theo quy định
              </span>
            </div>
          ) : fields.length > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Đang hiển thị danh mục trường metadata có sẵn của hồ sơ này</span>
            </div>
          ) : null}

          {groupedFields.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground italic">
              {t('metadataPicker.empty')}
            </div>
          ) : (
            groupedFields.map((group) => {
              const isDossier = group.groupCode.includes('HO_SO')
              return (
                <div key={group.groupCode} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {isDossier ? (
                      <Folder className="size-4 text-amber-500" />
                    ) : (
                      <FileText className="size-4 text-emerald-500" />
                    )}
                    <span>{group.groupName}</span>
                    <span className="text-[11px] font-normal text-muted-foreground/70">
                      ({group.items.length})
                    </span>
                  </div>

                  {/* 3 items per row on medium/large screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {group.items.map((field) => {
                      const isSelected =
                        selectedKey === field.key || selectedKey === field.fieldName
                      return (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => handleSelectField(field)}
                          className={cn(
                            'group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all cursor-pointer min-h-[96px]',
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                              : 'border-border/70 bg-card hover:bg-accent/40 hover:border-primary/50 hover:shadow-sm',
                            !isFallback && !field.hasValue && 'opacity-75 bg-muted/20 border-dashed',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 w-full">
                            <span
                              className={cn(
                                'text-sm font-semibold line-clamp-2 transition-colors',
                                isSelected
                                  ? 'text-primary'
                                  : 'text-foreground group-hover:text-primary',
                              )}
                            >
                              {field.display}
                            </span>
                            {isSelected ? (
                              <Check className="size-4 shrink-0 text-primary mt-0.5" />
                            ) : null}
                          </div>

                          {!isFallback ? (
                            <div className="mt-2 text-xs truncate">
                              {field.hasValue ? (
                                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate">Giá trị: "{field.sampleValue}"</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                  <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span className="italic">Chưa có dữ liệu</span>
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded text-[11px]">
                              {field.fieldName}
                            </span>
                            {!isFallback && (
                              <span
                                className={cn(
                                  'text-[11px] font-medium px-1.5 py-0.5 rounded',
                                  field.hasValue
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                                )}
                              >
                                {field.hasValue ? 'Có dữ liệu' : 'Trống'}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="px-6 py-3.5 border-t border-border bg-muted/10 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {filteredFields.length} {t('metadataPicker.fieldsFound', { defaultValue: 'trường metadata' })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('actions.cancel', { defaultValue: 'Đóng' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
