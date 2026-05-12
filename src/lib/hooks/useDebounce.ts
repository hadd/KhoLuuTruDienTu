import { useEffect, useState } from 'react'

/**
 * Debounce a value with a configurable delay
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 *
 * // Use debouncedSearch in queries to avoid firing on every keystroke
 * useQuery({
 *   queryKey: ['search', debouncedSearch],
 *   queryFn: () => fetchResults(debouncedSearch)
 * })
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
