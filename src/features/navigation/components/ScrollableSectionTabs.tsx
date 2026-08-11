import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { sectionBoxedTabsListClassName } from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'

const OVERLAY_PAD = 36

type ScrollableSectionTabsProps = {
  children: ReactNode
  activeKey?: string
  'aria-label'?: string
  className?: string
}

function getActiveTab(container: HTMLElement) {
  const tab = container.querySelector('[aria-current="page"]')
  return tab instanceof HTMLElement ? tab : null
}

export function ScrollableSectionTabs({
  children,
  activeKey,
  'aria-label': ariaLabel,
  className,
}: ScrollableSectionTabsProps) {
  const { t } = useTranslation('common')
  const scrollerRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  const scrollTabIntoView = useCallback(
    (behavior: ScrollBehavior, forceCenter: boolean) => {
      const container = scrollerRef.current
      if (!container) return
      const tab = getActiveTab(container)
      if (!tab) return

      const containerRect = container.getBoundingClientRect()
      const tabRect = tab.getBoundingClientRect()
      const fullyVisible =
        tabRect.left >= containerRect.left + OVERLAY_PAD &&
        tabRect.right <= containerRect.right - OVERLAY_PAD

      if (!forceCenter && fullyVisible) return

      const delta =
        tabRect.left -
        containerRect.left -
        (container.clientWidth - tabRect.width) / 2
      container.scrollTo({
        left: container.scrollLeft + delta,
        behavior,
      })
    },
    [],
  )

  useLayoutEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      scrollTabIntoView('instant', true)
      updateScrollState()
    }
    const frame = requestAnimationFrame(() => {
      run()
      requestAnimationFrame(run)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [activeKey, scrollTabIntoView, updateScrollState])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const onScroll = () => updateScrollState()
    el.addEventListener('scroll', onScroll, { passive: true })

    const observer = new ResizeObserver(() => {
      scrollTabIntoView('instant', false)
      updateScrollState()
    })
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [scrollTabIntoView, updateScrollState])

  const scrollByDirection = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const amount = Math.max(el.clientWidth * 0.7, 200)
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  return (
    <div className="relative min-w-0 shrink-0">
      <nav
        ref={scrollerRef}
        className={cn(
          sectionBoxedTabsListClassName,
          'min-w-0 flex-nowrap overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
        aria-label={ariaLabel}
      >
        {children}
      </nav>

      {canScrollLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-9 items-center bg-gradient-to-r from-background from-30% to-transparent">
          <button
            type="button"
            className="pointer-events-auto ml-0.5 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => scrollByDirection(-1)}
            aria-label={t('tabs.scrollLeft')}
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      ) : null}

      {canScrollRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-end bg-gradient-to-l from-background from-30% to-transparent">
          <button
            type="button"
            className="pointer-events-auto mr-0.5 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => scrollByDirection(1)}
            aria-label={t('tabs.scrollRight')}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
