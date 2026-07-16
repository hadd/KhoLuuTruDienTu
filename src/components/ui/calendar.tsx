import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { ChangeEvent, ComponentProps } from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import type { DropdownProps } from 'react-day-picker'

import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

export type CalendarProps = ComponentProps<typeof DayPicker>

function CalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const selected = options?.find((option) => option.value === Number(value))

  return (
    <Select
      value={value === undefined || value === '' ? undefined : String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        onChange?.({
          target: { value: next },
        } as ChangeEvent<HTMLSelectElement>)
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className="h-8 w-auto min-w-0 gap-1 border-input px-2 font-medium shadow-xs"
      >
        <SelectValue placeholder={selected?.label} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="center"
        className="z-[120] max-h-56 min-w-[var(--radix-select-trigger-width)]"
      >
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      {...props}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn('bg-background p-3', className)}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-4', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        month_caption: cn(
          'relative flex h-8 w-full items-center justify-center px-10',
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          'text-sm font-medium',
          captionLayout === 'label'
            ? ''
            : 'flex items-center gap-1 rounded-md pl-2 pr-1 [&>svg]:size-3.5',
          defaultClassNames.caption_label,
        ),
        dropdowns: cn(
          'relative z-[1] flex h-8 items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(defaultClassNames.dropdown),
        nav: cn(
          'absolute inset-x-0 top-0 z-10 flex w-full items-center justify-between pointer-events-none',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'pointer-events-auto relative z-10 size-8 shrink-0 p-0 opacity-70 hover:opacity-100',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'pointer-events-auto relative z-10 size-8 shrink-0 p-0 opacity-70 hover:opacity-100',
          defaultClassNames.button_next,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground w-9 rounded-md text-[0.8rem] font-normal',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          defaultClassNames.day,
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 p-0 font-normal aria-selected:opacity-100',
          defaultClassNames.day_button,
        ),
        range_start: cn(
          'bg-accent [&>button]:rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground',
          defaultClassNames.range_start,
        ),
        range_middle: cn(
          'bg-accent [&>button]:rounded-none [&>button]:bg-accent [&>button]:text-accent-foreground',
          defaultClassNames.range_middle,
        ),
        range_end: cn(
          'bg-accent [&>button]:rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground',
          defaultClassNames.range_end,
        ),
        selected: cn(
          '[&>button]:bg-primary [&>button]:text-primary-foreground',
          defaultClassNames.selected,
        ),
        today: cn(
          '[&>button]:bg-accent [&>button]:text-accent-foreground',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation, ...rest }) => {
          const Icon =
            orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon
          return <Icon className={cn('size-4', chevronClassName)} {...rest} />
        },
        Dropdown: CalendarDropdown,
        ...components,
      }}
    />
  )
}

export { Calendar }
