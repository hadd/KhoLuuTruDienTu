import { format, isValid, parse, parseISO } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import type { ChangeEvent, KeyboardEvent, Ref } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export type DatePickerMaskProps = {
  id?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  onClick?: () => void
  onFocus?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  inputRef?: Ref<HTMLInputElement | null>
}

/** Formats raw digits or text into dd/MM/yyyy mask */
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Parses value string (either yyyy-MM-dd or dd/MM/yyyy) to valid Date object if possible */
function parseValueToDate(val?: string): Date | undefined {
  if (!val || !val.trim()) return undefined
  const trimmed = val.trim()

  // Try ISO format yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed)
    if (isValid(parsed)) return parsed
  }

  // Try dd/MM/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parsed = parse(trimmed, 'dd/MM/yyyy', new Date())
    if (isValid(parsed) && format(parsed, 'dd/MM/yyyy') === trimmed) {
      return parsed
    }
  }

  return undefined
}

/** Formats date to dd/MM/yyyy for display */
function formatDisplayDate(val?: string): string {
  if (!val || !val.trim()) return ''
  const date = parseValueToDate(val)
  if (date) {
    return format(date, 'dd/MM/yyyy')
  }
  return val
}

export function DatePickerMask({
  id,
  value,
  onChange,
  placeholder = 'dd/MM/yyyy',
  className,
  disabled = false,
  onClick,
  onFocus,
  onKeyDown,
  inputRef,
}: DatePickerMaskProps) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const locale = i18n.language.startsWith('vi') ? vi : enUS

  const [displayValue, setDisplayValue] = useState(() => formatDisplayDate(value))

  useEffect(() => {
    setDisplayValue(formatDisplayDate(value))
  }, [value])

  const selectedDate = useMemo(() => parseValueToDate(displayValue), [displayValue])
  const [month, setMonth] = useState<Date>(() => selectedDate ?? new Date())

  useEffect(() => {
    if (open) {
      setMonth(selectedDate ?? new Date())
    }
  }, [open, selectedDate])

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    const masked = applyDateMask(rawValue)
    setDisplayValue(masked)

    if (masked.length === 10) {
      const parsed = parse(masked, 'dd/MM/yyyy', new Date())
      if (isValid(parsed) && format(parsed, 'dd/MM/yyyy') === masked) {
        onChange(format(parsed, 'yyyy-MM-dd'))
        return
      }
    }
    onChange(masked)
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd

      // If user presses backspace right after a slash (at pos 3 or 6) with no range selection
      if (start === end && (start === 3 || start === 6)) {
        e.preventDefault()
        const nextDigits = displayValue.replace(/\D/g, '').slice(0, -1)
        const masked = applyDateMask(nextDigits)
        setDisplayValue(masked)
        onChange(masked)
        return
      }
    }

    onKeyDown?.(e)
  }

  function handleSelectCalendarDate(day: Date | undefined) {
    if (!day || !isValid(day)) {
      setDisplayValue('')
      onChange('')
      setOpen(false)
      return
    }

    const isoDate = format(day, 'yyyy-MM-dd')
    const formattedDisplay = format(day, 'dd/MM/yyyy')
    setDisplayValue(formattedDisplay)
    onChange(isoDate)
    setOpen(false)
  }

  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <Input
        id={id}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onClick={onClick}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        ref={inputRef as Ref<HTMLInputElement | null>}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 size-7 text-muted-foreground hover:text-foreground"
            aria-label="Open calendar"
          >
            <CalendarIcon className="size-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectCalendarDate}
            month={month}
            onMonthChange={setMonth}
            locale={locale}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(new Date().getFullYear() + 50, 11)}
          />
          {selectedDate ? (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => handleSelectCalendarDate(undefined)}
              >
                <X className="size-3.5" />
                Bỏ chọn
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
