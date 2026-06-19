import type { ReactNode } from 'react'

import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'

interface AppHeaderProps {
  trailing?: ReactNode
}

export function AppHeader({ trailing }: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <AppLogo className="h-7 sm:h-8" />
      <div className="flex items-center gap-2">
        {trailing}
        <UserAccountMenu variant="header" />
      </div>
    </header>
  )
}
