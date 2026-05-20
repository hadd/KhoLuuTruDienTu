import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a debounced version of the callback that delays invocation until after
 * `delay` ms have elapsed since the last call.
 *
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced callback (stable reference)
 */
export function useDebouncedCallback<
  T extends (...args: Parameters<T>) => void,
>(callback: T, delay: number): T {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return useCallback(
    ((...args: Parameters<T>) => {
      lastArgsRef.current = args
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const argsToUse = lastArgsRef.current
        if (argsToUse) {
          callbackRef.current(...argsToUse)
        }
      }, delay)
    }) as T,
    [delay],
  )
}
