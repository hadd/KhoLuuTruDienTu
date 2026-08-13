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
  contentGap?: string
  children: ReactNode
}

export function IconHubPageLayout({
  title,
  back,
  maxWidth = 'max-w-3xl',
  contentGap = 'gap-10 sm:gap-12',
  children,
}: IconHubPageLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex w-full shrink-0 items-center px-6 pt-3 sm:pt-4">
        {back ? <IconHubBackLink {...back} /> : null}
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col items-center px-6 pb-16',
          back ? 'pt-4 sm:pt-6' : 'pt-10 sm:pt-14',
        )}
      >
        <div
          className={cn(
            'flex w-full flex-col items-center',
            contentGap,
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
