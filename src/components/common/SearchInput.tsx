import { Search } from 'lucide-react'
import * as React from 'react'
import { useEffect, useRef } from 'react'

import { Input } from '@/components/ui/input'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { cn } from '@/lib/utils/cn'

export interface SearchInputProps {
  /**
   * Current input value
   */
  value: string
  /**
   * Callback when input value changes (immediate)
   */
  onChange: (value: string) => void
  /**
   * Callback when debounced value changes
   */
  onDebouncedChange?: (value: string) => void
  /**
   * Placeholder text for the input
   */
  placeholder?: string
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Whether the input is disabled
   */
  disabled?: boolean
}

/**
 * SearchInput - Search input component with debounce
 *
 * This component provides a reusable pattern for search inputs with debouncing.
 * It handles input state and debounced value changes, similar to SearchSelect pattern.
 *
 * @example
 * // ✅ Correct - Use with debounced change handler
 * <SearchInput
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   onDebouncedChange={(debouncedValue) => {
 *     // Handle debounced search
 *   }}
 *   placeholder="Search..."
 * />
 */
export const SearchInput = React.memo(function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  placeholder,
  className,
  disabled = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState(value)
  const debouncedValue = useDebounce(internalValue, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const wasFocusedRef = useRef(false)

  // Track if input was focused before re-render
  useEffect(() => {
    wasFocusedRef.current = document.activeElement === inputRef.current
  })

  // Sync internal value with prop value (controlled component)
  useEffect(() => {
    setInternalValue(value)
  }, [value])

  // Call onDebouncedChange when debounced value changes (after 300ms delay)
  useEffect(() => {
    onDebouncedChange?.(debouncedValue)
  }, [debouncedValue, onDebouncedChange])

  // Restore focus after re-render if it was focused before
  useEffect(() => {
    if (wasFocusedRef.current && inputRef.current) {
      inputRef.current.focus()
      wasFocusedRef.current = false
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInternalValue(newValue)
    onChange(newValue)
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={internalValue}
        onChange={handleChange}
        className={cn('pl-9 rounded-full', className)}
        disabled={disabled}
      />
    </div>
  )
})
