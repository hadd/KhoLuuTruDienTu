import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppBreadcrumb } from '@/components/common/AppBreadcrumb'
import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { cn } from '@/lib/utils/cn'

type AppHeaderProps = {
  collapsed: boolean
  onToggleSidebar: () => void
}

export function AppHeader({ collapsed, onToggleSidebar }: AppHeaderProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex h-14 shrink-0 border-b border-border bg-card">
      <div
        className={cn(
          'flex h-full shrink-0 items-center border-r border-border transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-[4.5rem] justify-center px-2' : 'w-64 px-4',
        )}
      >
        <AppLogo
          className={
            collapsed ? 'h-7 max-w-full sm:h-7' : 'h-9 max-w-full sm:h-9'
          }
        />
      </div>

      <header className="flex min-w-0 flex-1 items-center justify-between px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors',
              'hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
            )}
            aria-label={
              collapsed
                ? t('actions.expandSidebar')
                : t('actions.collapseSidebar')
            }
            title={
              collapsed
                ? t('actions.expandSidebar')
                : t('actions.collapseSidebar')
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronsRight className="size-5" />
            ) : (
              <ChevronsLeft className="size-5" />
            )}
          </button>
          <AppBreadcrumb />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <UserAccountMenu variant="header" />
        </div>
      </header>
    </div>
  )
}
