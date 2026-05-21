import { Link } from '@tanstack/react-router'
import { FolderTree, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { cn } from '@/lib/utils/cn'

const roleBasePath: Record<DataManagementRole, string> = {
  admin: '/admin/data',
  editor: '/editor/data',
  qc: '/qc/data',
}

export function RoleSidebar({
  role,
  className,
  collapsed = false,
  onToggleCollapse,
}: {
  role: DataManagementRole
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { t } = useTranslation('data-management')
  const basePath = roleBasePath[role] ?? '/editor/data'
  const itemLabel =
    role === 'editor' ? t('sidebar.items.editor') : t('sidebar.items.data')

  return (
    <aside
      className={cn(
        'flex h-full w-full shrink-0 flex-col border-r border-border bg-card',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b border-border px-3 py-3',
          collapsed && 'px-2',
        )}
      >
        {collapsed ? <span /> : (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('sidebar.title')}
          </p>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted',
            !onToggleCollapse && 'pointer-events-none opacity-50',
          )}
          aria-label={t('sidebar.title')}
        >
          <Menu className="size-4" />
        </button>
      </div>
      <nav className={cn('flex flex-col gap-1 p-2', collapsed && 'p-2')}
      >
        <Link
          to={basePath}
          className="block"
          activeProps={{
            className: '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
          }}
          inactiveProps={{
            className: '[&>div]:hover:bg-muted/80',
          }}
        >
          {({ isActive }) => (
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
                !isActive && 'text-muted-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <FolderTree className="size-4 shrink-0" />
              {collapsed ? null : <span>{itemLabel}</span>}
            </div>
          )}
        </Link>
      </nav>
    </aside>
  )
}
