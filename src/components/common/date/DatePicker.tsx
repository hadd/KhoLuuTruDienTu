import { format, isValid, parseISO } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

type DatePickerProps = {
  value?: string
  onChange: (value?: string) => void
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

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: DatePickerProps) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const locale = i18n.language.startsWith('vi') ? vi : enUS

  const selected = useMemo(() => parseDay(value), [value])
  const [month, setMonth] = useState<Date>(() => selected ?? new Date())

  useEffect(() => {
    if (open) {
      setMonth(selected ?? new Date())
    }
  }, [open, selected])

  const display = selected ? format(selected, 'dd/MM/yyyy') : null

  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-9 w-full justify-start gap-2 px-3 font-normal',
              !selected && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">
              {display ?? placeholder ?? 'Chọn ngày'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              onChange(toIsoDay(day))
              setOpen(false)
            }}
            month={month}
            onMonthChange={setMonth}
            locale={locale}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(new Date().getFullYear() + 50, 11)}
          />
          <div className="border-t p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
            >
              <X className="size-4" />
              Bỏ chọn
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
