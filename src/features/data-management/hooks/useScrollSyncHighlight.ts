import { useCallback, useEffect, useRef } from 'react'

/**
 * Selector used to find observable field elements inside the scroll container.
 * Each element must have `data-field-sync`, `data-group-index`, and
 * `data-field-index` attributes.
 */
export const FIELD_SYNC_SELECTOR = '[data-field-sync]'

export interface UseScrollSyncHighlightOptions {
  /** Ref to the scrollable metadata container. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  /** Called when the most-visible field changes due to scrolling. */
  onVisibleFieldChange: (groupIndex: number, fieldIndex: number) => void
  /** Set to false to disable observation (e.g. when on the history tab). */
  enabled: boolean
}

/**
 * Suppress scroll-sync for this many ms after a user-initiated interaction
 * (click / focus / keyboard navigation) so the manually chosen highlight is
 * not immediately overridden by the scroll observer.
 */
const USER_INTERACTION_SUPPRESSION_MS = 600

/** Debounce interval before committing a scroll-driven highlight change. */
const DEBOUNCE_MS = 150

/**
 * Observes field elements inside a scrollable container and calls back when
 * the "most centred" field changes.  This lets the PDF viewer auto-scroll to
 * whichever metadata field the user is currently looking at.
 *
 * The hook re-scans for observable elements whenever `enabled` changes or the
 * container's subtree mutates (fields added/removed after OCR, etc.).
 */
export function useScrollSyncHighlight({
  scrollContainerRef,
  onVisibleFieldChange,
  enabled,
}: UseScrollSyncHighlightOptions) {
  const suppressUntilRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmittedRef = useRef<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const visibleMapRef = useRef<Map<Element, IntersectionObserverEntry>>(
    new Map(),
  )

  // ---- public: call this from click / focus handlers to suppress scroll-sync
  const suppressScrollSync = useCallback(() => {
    suppressUntilRef.current = Date.now() + USER_INTERACTION_SUPPRESSION_MS
  }, [])

  // ---- pick the best candidate from the currently-visible set
  const pickBestCandidate = useCallback(
    (container: HTMLDivElement) => {
      if (visibleMapRef.current.size === 0) return

      const containerRect = container.getBoundingClientRect()
      const containerCenterY = containerRect.top + containerRect.height / 2

      let bestElement: Element | null = null
      let bestDistance = Infinity

      visibleMapRef.current.forEach((entry, element) => {
        if (!entry.isIntersecting) return
        const rect = element.getBoundingClientRect()
        const elementCenterY = rect.top + rect.height / 2
        const distance = Math.abs(elementCenterY - containerCenterY)

        if (distance < bestDistance) {
          bestDistance = distance
          bestElement = element
        }
      })

      if (!bestElement) return

      const groupIndex = Number(
        (bestElement as HTMLElement).dataset.groupIndex,
      )
      const fieldIndex = Number(
        (bestElement as HTMLElement).dataset.fieldIndex,
      )

      if (Number.isNaN(groupIndex) || Number.isNaN(fieldIndex)) return

      const key = `${groupIndex}-${fieldIndex}`
      if (key === lastEmittedRef.current) return

      lastEmittedRef.current = key
      onVisibleFieldChange(groupIndex, fieldIndex)
    },
    [onVisibleFieldChange],
  )

  // ---- schedule a debounced pick
  const scheduleUpdate = useCallback(
    (container: HTMLDivElement) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        if (Date.now() < suppressUntilRef.current) return
        pickBestCandidate(container)
      }, DEBOUNCE_MS)
    },
    [pickBestCandidate],
  )

  // ---- main effect: set up IntersectionObserver + MutationObserver
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!enabled || !container) {
      // Cleanup previous observer if disabling
      observerRef.current?.disconnect()
      observerRef.current = null
      visibleMapRef.current.clear()
      lastEmittedRef.current = null
      return
    }

    // IntersectionObserver with rootMargin that narrows the detection zone to
    // roughly the central 40% of the container (skip top/bottom 30%).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleMapRef.current.set(entry.target, entry)
          } else {
            visibleMapRef.current.delete(entry.target)
          }
        }
        scheduleUpdate(container)
      },
      {
        root: container,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      },
    )
    observerRef.current = observer

    // Observe all existing field elements
    function observeAll() {
      observer.disconnect()
      visibleMapRef.current.clear()
      const elements = container!.querySelectorAll(FIELD_SYNC_SELECTOR)
      elements.forEach((el) => observer.observe(el))
    }

    observeAll()

    // Watch for DOM mutations (fields added/removed, e.g. after OCR completes)
    const mutationObserver = new MutationObserver(() => {
      observeAll()
    })
    mutationObserver.observe(container, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      observerRef.current = null
      mutationObserver.disconnect()
      visibleMapRef.current.clear()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [enabled, scrollContainerRef, scheduleUpdate])

  return { suppressScrollSync }
}
