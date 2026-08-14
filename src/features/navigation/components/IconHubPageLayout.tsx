import type { ReactNode } from 'react'

import {
  IconHubBackLink,
  type HubBackTo,
} from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'

type IconHubBackConfig = {
  to: HubBackTo
  parentLabel: string
  backAriaLabel: string
}

type IconHubPageLayoutProps = {
  title: string
  back?: IconHubBackConfig
  maxWidth?: string
  children: ReactNode
}

/** Shared tile classes — one size for every icon hub so switching screens does not jump. */
export const iconHubTileLinkClassName =
  'group flex flex-col items-center gap-4 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring'

export const iconHubTileIconWrapClassName =
  'flex size-36 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-44'

export const iconHubTileIconClassName = 'size-16 sm:size-20'

export const iconHubTileLabelClassName =
  'text-center text-lg font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-xl'

export const iconHubTileGridGapClassName = 'gap-x-10 gap-y-8 sm:gap-x-14 sm:gap-y-10'

/** Nested (child) hub tiles — smaller than top-level to show hierarchy. */
export const iconHubNestedTileLinkClassName =
  'group flex flex-col items-center gap-2.5 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring sm:gap-3'

export const iconHubNestedTileIconWrapClassName =
  'flex size-24 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-28'

export const iconHubNestedTileIconClassName = 'size-10 sm:size-12'

export const iconHubNestedTileLabelClassName =
  'text-center text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-base'

export const iconHubNestedTileGridGapClassName = 'gap-x-6 gap-y-6 sm:gap-x-8 sm:gap-y-8'

/** Child icon hubs always use 5 columns on desktop. */
export const iconHubNestedTileGridClassName =
  'grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5'

/**
 * Fixed vertical rhythm for all icon hub screens:
 * - always reserves back-link row height (even when empty)
 * - same title size / gaps / padding
 */
export function IconHubPageLayout({
  title,
  back,
  maxWidth = 'max-w-5xl',
  children,
}: IconHubPageLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 w-full shrink-0 items-center sm:h-10">
        {back ? <IconHubBackLink {...back} /> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden pt-3 sm:pt-4">
        <div
          className={cn(
            'flex w-full flex-col items-center gap-8 sm:gap-10',
            maxWidth,
          )}
        >
          <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  )
}
