import { format, isValid, parseISO } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export type DateRangeValue = {
  from?: string
  to?: string
}

type DateRangePickerProps = {
  label: string
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function parseDay(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function toIsoDay(date?: Date): string | undefined {
  if (!date || !isValid(date)) return undefined
  return format(date, 'yyyy-MM-dd')
}

function formatDisplayRange(from?: string, to?: string): string | null {
  const fromDate = parseDay(from)
  const toDate = parseDay(to)
  if (!fromDate && !toDate) return null
  if (fromDate && toDate) {
    return `${format(fromDate, 'dd/MM/yyyy')} - ${format(toDate, 'dd/MM/yyyy')}`
  }
  if (fromDate) return `${format(fromDate, 'dd/MM/yyyy')} - …`
  if (toDate) return format(toDate, 'dd/MM/yyyy')
  return null
}

export function DateRangePicker({
  label,
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation('archive-warehouse')
  const [open, setOpen] = useState(false)
  const locale = i18n.language.startsWith('vi') ? vi : enUS

  const selected = useMemo<DateRange | undefined>(() => {
    const from = parseDay(value.from)
    const to = parseDay(value.to)
    if (!from && !to) return undefined
    return { from, to }
  }, [value.from, value.to])

  const [month, setMonth] = useState<Date>(
    () => selected?.from ?? selected?.to ?? new Date(),
  )

  useEffect(() => {
    if (open) {
      setMonth(selected?.from ?? selected?.to ?? new Date())
    }
    // Only reset when the popover opens — not on every selection change,
    // otherwise month navigation can fight with controlled month state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open])

  const display = formatDisplayRange(value.from, value.to)
  const hasValue = Boolean(value.from || value.to)

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span className="shrink-0 text-sm text-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-9 min-w-[12.5rem] justify-start gap-2 px-3 font-normal',
              !hasValue && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">
              {display ?? placeholder ?? t('filters.dateRangePlaceholder')}
            </span>
            {hasValue ? (
              <span
                role="button"
                tabIndex={0}
                className="ml-auto inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange({ from: undefined, to: undefined })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onChange({ from: undefined, to: undefined })
                  }
                }}
                aria-label={t('filters.clearDateRange')}
              >
                <X className="size-3.5" aria-hidden />
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          // Vị trí hiện calendar so với ô input:
          // side: 'top' | 'bottom' | 'left' | 'right'
          // align: 'start' | 'center' | 'end'
          // sideOffset: khoảng cách (px) với trigger
          align="start"
          side="right"
          sideOffset={8}
          collisionPadding={24}
          className="z-[100] w-auto overflow-visible p-0"
          onInteractOutside={(event) => {
            // Select (tháng/năm) render qua portal — đừng đóng calendar khi chọn
            const target = event.target as HTMLElement | null
            if (target?.closest('[data-slot="select-content"]')) {
              event.preventDefault()
            }
          }}
        >
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {t('filters.selectDate')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {value.from && value.to
                ? t('filters.selectedDateRange', { range: display })
                : value.from
                  ? t('filters.selectEndDateHint')
                  : t('filters.selectDateHint')}
            </p>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={1}
            locale={locale}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 15, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(range) => {
              onChange({
                from: toIsoDay(range?.from),
                to: range?.to ? toIsoDay(range.to) : undefined,
              })
              if (range?.from && range?.to) {
                setOpen(false)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
