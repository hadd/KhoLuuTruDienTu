import {
  format,
  getHours,
  getMinutes,
  isValid,
  parse,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
} from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

const TIME_STEP_MINUTES = 15
const TIME_SLOTS = Array.from(
  { length: (24 * 60) / TIME_STEP_MINUTES },
  (_, index) => {
    const total = index * TIME_STEP_MINUTES
    const hours = Math.floor(total / 60)
    const minutes = total % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  },
)

type DateTimePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function parseDateTime(value?: string): Date | undefined {
  if (!value) return undefined

  const localParsed = parse(value, "yyyy-MM-dd'T'HH:mm", new Date())
  if (isValid(localParsed)) return localParsed

  const isoParsed = parseISO(value)
  return isValid(isoParsed) ? isoParsed : undefined
}

function toLocalDateTimeValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function roundToStepMinutes(date: Date, step = TIME_STEP_MINUTES): Date {
  const minutes = getMinutes(date)
  const rounded = Math.round(minutes / step) * step
  if (rounded === 60) {
    return setSeconds(setMinutes(setHours(date, getHours(date) + 1), 0), 0)
  }
  return setSeconds(setMinutes(date, rounded), 0)
}

function timeSlotOf(date: Date): string {
  const rounded = roundToStepMinutes(date)
  return format(rounded, 'HH:mm')
}

function applyTimeSlot(base: Date, slot: string): Date {
  const [hours, minutes] = slot.split(':').map(Number)
  return setSeconds(setMinutes(setHours(base, hours), minutes), 0)
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'dd-MM-yyyy HH:mm',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const locale = i18n.language.startsWith('vi') ? vi : enUS
  const selected = useMemo(() => parseDateTime(value), [value])
  const [month, setMonth] = useState<Date>(() => selected ?? new Date())
  const timeListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setMonth(selected ?? new Date())

    const slot = selected ? timeSlotOf(selected) : null
    if (!slot) return

    requestAnimationFrame(() => {
      const list = timeListRef.current
      const item = list?.querySelector<HTMLElement>(`[data-time="${slot}"]`)
      item?.scrollIntoView({ block: 'center' })
    })
    // Only sync when popover opens
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open])

  const display = selected ? format(selected, 'dd-MM-yyyy HH:mm') : null
  const activeSlot = selected ? timeSlotOf(selected) : null

  function emit(next: Date) {
    onChange(toLocalDateTimeValue(next))
  }

  function scrollTimeList(direction: 'up' | 'down') {
    const list = timeListRef.current
    if (!list) return
    list.scrollBy({ top: direction === 'up' ? -96 : 96, behavior: 'smooth' })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between gap-2 px-3 font-normal',
            !display && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{display ?? placeholder}</span>
          <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={24}
        className="z-[100] w-auto overflow-visible p-0"
        style={{ overscrollBehavior: 'contain' }}
        onWheel={(event) => event.stopPropagation()}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest('[data-slot="select-content"]')) {
            event.preventDefault()
          }
        }}
      >
        <div className="flex">
          <Calendar
            mode="single"
            locale={locale}
            weekStartsOn={0}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 15, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(day) => {
              if (!day) return
              const base = selected ?? roundToStepMinutes(new Date())
              emit(applyTimeSlot(day, timeSlotOf(base)))
            }}
          />

          <div className="flex w-[5.5rem] flex-col border-l">
            <button
              type="button"
              className="flex h-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => scrollTimeList('up')}
              aria-label="Scroll time up"
            >
              <ChevronUpIcon className="size-4" aria-hidden />
            </button>
            <div
              ref={timeListRef}
              className="max-h-[14.5rem] flex-1 overflow-y-auto overscroll-contain px-1"
              onWheel={(event) => {
                // Dialog RemoveScroll portals block native wheel on popover content;
                // stop bubbling and apply scroll manually so the time list stays usable.
                event.stopPropagation()
                const list = event.currentTarget
                if (list.scrollHeight <= list.clientHeight) return
                list.scrollTop += event.deltaY
                event.preventDefault()
              }}
            >
              {TIME_SLOTS.map((slot) => {
                const isActive = slot === activeSlot
                return (
                  <button
                    key={slot}
                    type="button"
                    data-time={slot}
                    className={cn(
                      'flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm tabular-nums',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted',
                    )}
                    onClick={() => {
                      const base = selected ?? new Date()
                      emit(applyTimeSlot(base, slot))
                    }}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="flex h-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => scrollTimeList('down')}
              aria-label="Scroll time down"
            >
              <ChevronDownIcon className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
