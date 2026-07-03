import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createEmptyPaperPlanRow,
  getSelectedPaperSizeNames,
  normalizePaperSizeName,
  sumPaperPlanQuantities,
} from '@/features/plan-management/lib/planPaperPlanDefaults'
import type { PaperPlanRowFormValues } from '@/features/plan-management/lib/planPaperPlanRowSchema'
import { paperSizesQueryOptions } from '@/features/plan-management/queries'
import type { PlanFormValues } from '@/features/plan-management/schemas'
import type { PaperSizeT } from '@/features/plan-management/types'
import type { AppFormApi } from '@/lib/forms'
import { cn } from '@/lib/utils/cn'

interface PlanPaperPlansFieldsProps {
  form: AppFormApi<PlanFormValues>
}

interface PaperSizeComboboxProps {
  value: string
  onChange: (value: string) => void
  paperSizes: Array<PaperSizeT>
  disabledPaperSizeNames: Set<string>
  isPending: boolean
  isError: boolean
}

function updatePaperPlanRow(
  rows: Array<PaperPlanRowFormValues>,
  index: number,
  nextRow: PaperPlanRowFormValues,
): Array<PaperPlanRowFormValues> {
  return rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row))
}

// Inline dropdown (no Portal) to work correctly inside Radix Dialog.
// PopoverPrimitive.Portal renders outside the Dialog DOM which causes
// aria-hidden / pointer-event issues in modal Dialog contexts.
function PaperSizeCombobox({
  value,
  onChange,
  paperSizes,
  disabledPaperSizeNames,
  isPending,
  isError,
}: PaperSizeComboboxProps) {
  const { t } = useTranslation('plan-management')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside this component
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [open])

  const availablePaperSizes = useMemo(
    () =>
      paperSizes.filter(
        (paperSize) =>
          !disabledPaperSizeNames.has(normalizePaperSizeName(paperSize.name)),
      ),
    [disabledPaperSizeNames, paperSizes],
  )

  const filteredSizes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return availablePaperSizes
    }

    return availablePaperSizes.filter((paperSize) =>
      paperSize.name.toLowerCase().includes(normalizedSearch),
    )
  }, [availablePaperSizes, search])

  const trimmedSearch = search.trim()
  const isExactMatch = paperSizes.some(
    (paperSize) => paperSize.name.toLowerCase() === trimmedSearch.toLowerCase(),
  )
  const isAlreadySelectedElsewhere = disabledPaperSizeNames.has(
    normalizePaperSizeName(trimmedSearch),
  )
  const showCreateNew =
    trimmedSearch.length > 0 && !isExactMatch && !isAlreadySelectedElsewhere

  const handleToggle = () => {
    if (open) {
      setOpen(false)
      setSearch('')
      return
    }
    setOpen(true)
    setSearch(value)
  }

  const handleSelect = (nextValue: string) => {
    if (disabledPaperSizeNames.has(normalizePaperSizeName(nextValue))) {
      return
    }

    onChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  const triggerLabel = isPending
    ? t('form.fields.paperSize.loading')
    : isError
      ? t('form.fields.paperSize.loadFailed')
      : t('form.fields.paperSize.placeholder')

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={handleToggle}
        className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setSearch('')
          }
        }}
      >
        {isPending ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('form.fields.paperSize.loading')}
          </span>
        ) : value ? (
          <span className="truncate text-foreground">{value}</span>
        ) : (
          <span className="truncate text-muted-foreground">{triggerLabel}</span>
        )}
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandInput
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={t('form.fields.paperSize.placeholder')}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                  setSearch('')
                }
              }}
            />
            <CommandList>
              {filteredSizes.length === 0 && !showCreateNew ? (
                <CommandEmpty>{t('form.fields.paperSize.noResults')}</CommandEmpty>
              ) : null}

              <CommandGroup>
                {filteredSizes.map((paperSize) => (
                  <CommandItem
                    key={paperSize.id}
                    value={paperSize.name}
                    onSelect={() => handleSelect(paperSize.name)}
                  >
                    <Check
                      className={cn(
                        'size-4',
                        value === paperSize.name ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {paperSize.name}
                  </CommandItem>
                ))}

                {showCreateNew ? (
                  <CommandItem
                    value={`__create__${trimmedSearch}`}
                    onSelect={() => handleSelect(trimmedSearch)}
                  >
                    {t('form.fields.paperSize.createNew', { name: trimmedSearch })}
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

export function PlanPaperPlansFields({ form }: PlanPaperPlansFieldsProps) {
  const { t } = useTranslation('plan-management')
  const { data, isPending, isError } = useQuery(paperSizesQueryOptions())
  const paperSizes = data?.items ?? []
  const paperPlans: Array<PaperPlanRowFormValues> = useStore(
    form.store,
    (state) => (state as { values: PlanFormValues }).values.paperPlans,
  )
  const totalPages = sumPaperPlanQuantities(paperPlans)

  const handleAddRow = () => {
    form.setFieldValue('paperPlans', [...paperPlans, createEmptyPaperPlanRow()])
  }

  const handleRemoveRow = (index: number) => {
    if (paperPlans.length <= 1) {
      return
    }

    form.setFieldValue(
      'paperPlans',
      paperPlans.filter((_, rowIndex) => rowIndex !== index),
    )
  }

  const updateRow = (index: number, patch: Partial<PaperPlanRowFormValues>) => {
    const row = paperPlans[index]
    if (!row) {
      return
    }

    form.setFieldValue(
      'paperPlans',
      updatePaperPlanRow(paperPlans, index, { ...row, ...patch }),
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('form.fields.totalPages.label')}</Label>
        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground">
          {totalPages}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('form.fields.totalPages.hint')}
        </p>
      </div>

      <div className="space-y-2">
        {paperPlans.map((row, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('form.fields.paperQuantity.label')}
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  className="w-full"
                  value={row.quantity === 0 ? '' : String(row.quantity)}
                  placeholder={t('form.fields.paperQuantity.placeholder')}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9]/g, '')
                    if (raw === '') {
                      updateRow(index, { quantity: 0 })
                      return
                    }

                    const parsed = parseInt(raw, 10)
                    if (!Number.isNaN(parsed)) {
                      updateRow(index, { quantity: parsed })
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('form.fields.paperSize.label')}
                </Label>
                <PaperSizeCombobox
                  value={row.paperSizeName}
                  onChange={(paperSizeName) =>
                    updateRow(index, { paperSizeName })
                  }
                  paperSizes={paperSizes}
                  disabledPaperSizeNames={getSelectedPaperSizeNames(
                    paperPlans,
                    index,
                  )}
                  isPending={isPending}
                  isError={isError}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn('size-9 shrink-0', paperPlans.length <= 1 && 'invisible')}
              onClick={() => handleRemoveRow(index)}
              disabled={paperPlans.length <= 1}
              aria-label={t('form.fields.paperPlans.removeRow')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          onClick={handleAddRow}
          aria-label={t('form.fields.paperPlans.addRow')}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
