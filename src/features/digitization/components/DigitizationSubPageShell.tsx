import type { ReactNode } from 'react'

import {
  DigitizationSectionTabs,
  type DigitizationSectionTabT,
} from '@/features/digitization/components/DigitizationSectionTabs'
import { cn } from '@/lib/utils/cn'

export function DigitizationSubPageShell({
  active,
  children,
  className,
}: {
  active: DigitizationSectionTabT
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-0 min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 pt-3',
        className,
      )}
    >
      <div className="shrink-0">
        <DigitizationSectionTabs active={active} compact />
      </div>
      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
