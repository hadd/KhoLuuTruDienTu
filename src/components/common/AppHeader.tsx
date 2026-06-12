import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <AppLogo className="h-7 sm:h-8" />
      <UserAccountMenu variant="header" />
    </header>
  )
}
