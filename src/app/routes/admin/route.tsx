import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { FolderTree, Menu, Users, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

import { requireAuth } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/admin')({
    beforeLoad: requireAuth,
    component: AdminLayout,
})

function AdminLayout() {
    const { t } = useTranslation('common')
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div className="flex min-h-0 w-full flex-1 bg-background">
            <aside 
                 className={cn(
                     "flex shrink-0 flex-col border-r border-border bg-card transition-all duration-300",
                     collapsed ? "w-[4.5rem]" : "w-56"
                 )}
            >
                <div className={cn(
                    "flex items-center border-b border-border py-[0.875rem]",
                    collapsed ? "justify-center px-2" : "justify-between px-4"
                )}>
                    {!collapsed && (
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap overflow-hidden">
                            {t('admin.menuTitle')}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted shrink-0"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu className="size-4" />
                    </button>
                </div>
                <nav className={cn(
                    "flex flex-col gap-1 py-3",
                    collapsed ? "px-2" : "px-3"
                )}>
                    <AdminNavLink to="/admin/users" label={t('admin.users')} icon={Users} collapsed={collapsed} />
                    <AdminNavLink to="/admin/groups" label={t('admin.groups')} icon={UsersRound} collapsed={collapsed} />
                    <AdminNavLink
                        to="/admin/data"
                        label={t('admin.dataManagement')}
                        icon={FolderTree}
                        collapsed={collapsed}
                    />
                </nav>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <div className="flex-1 p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

function AdminNavLink({
    to,
    label,
    icon: Icon,
    collapsed,
}: {
    to: '/admin/users' | '/admin/groups' | '/admin/data'
    label: string
    icon: React.ComponentType<{ className?: string }>
    collapsed?: boolean
}) {
    return (
        <Link
            to={to}
            className="block"
            activeProps={{
                className: '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
            }}
            inactiveProps={{
                className: '[&>div]:hover:bg-muted/80',
            }}
            title={collapsed ? label : undefined}
        >
            {({ isActive }) => (
                <div
                    className={cn(
                        'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
                        !isActive && 'text-muted-foreground',
                        collapsed && 'justify-center px-2'
                    )}
                >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
                </div>
            )}
        </Link>
    )
}