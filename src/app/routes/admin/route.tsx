import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, FolderTree, Menu, Users, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'
import { requireRole } from '@/features/auth/routeGuards'
import { adminPermissionNavGroup } from '@/features/permissions/config/adminNavConfig'
import { cn } from '@/lib/utils/cn'

export const Route = createFileRoute('/admin')({
    beforeLoad: () => requireRole('admin'),
    component: AdminLayout,
})

function AdminLayout() {
    const { t } = useTranslation('common')
    const [collapsed, setCollapsed] = useState(false)
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const isPermissionsActive = pathname.startsWith(adminPermissionNavGroup.basePath)
    const [permissionsOpen, setPermissionsOpen] = useState(isPermissionsActive)

    useEffect(() => {
        if (isPermissionsActive) {
            setPermissionsOpen(true)
        }
    }, [isPermissionsActive])

    return (
        <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background">
            <aside 
                 className={cn(
                     "flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-300",
                     collapsed ? "w-[4.5rem]" : "w-56"
                 )}
            >
                <div className={cn(
                    "flex items-center border-b border-border py-[0.875rem]",
                    collapsed ? "justify-center px-2" : "justify-between px-4"
                )}>
                    {!collapsed && <AppLogo className="h-7 sm:h-8" />}
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
                    "flex flex-1 flex-col gap-1 overflow-y-auto py-3",
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
                    <AdminNavGroup
                        group={adminPermissionNavGroup}
                        isOpen={permissionsOpen}
                        onToggle={() => setPermissionsOpen((prev) => !prev)}
                        collapsed={collapsed}
                        t={t}
                    />
                </nav>
                <div className="mt-auto shrink-0 border-t border-border p-3">
                    <UserAccountMenu collapsed={collapsed} />
                </div>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

type AdminNavTo = '/admin/users' | '/admin/groups' | '/admin/data'

function AdminNavLink({
    to,
    label,
    icon: Icon,
    collapsed,
}: {
    to: AdminNavTo
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

function AdminNavGroup({
    group,
    isOpen,
    onToggle,
    collapsed,
    t,
}: {
    group: typeof adminPermissionNavGroup
    isOpen: boolean
    onToggle: () => void
    collapsed?: boolean
    t: ReturnType<typeof useTranslation<'common'>>['t']
}) {
    const GroupIcon = group.icon
    const groupLabel = t(group.labelKey)

    if (collapsed) {
        return (
            <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                    <AdminNavSubLink
                        key={item.to}
                        to={item.to}
                        label={t(item.labelKey)}
                        icon={item.icon}
                        collapsed
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-0.5">
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    'flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
                    isOpen ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/80',
                )}
                aria-expanded={isOpen}
            >
                <span className="flex items-center gap-2">
                    <GroupIcon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden text-left">
                        {groupLabel}
                    </span>
                </span>
                {isOpen ? (
                    <ChevronDown className="size-4 shrink-0" />
                ) : (
                    <ChevronRight className="size-4 shrink-0" />
                )}
            </button>
            {isOpen && (
                <div className="ml-2 flex flex-col gap-0.5 border-l border-border pl-2">
                    {group.items.map((item) => (
                        <AdminNavSubLink
                            key={item.to}
                            to={item.to}
                            label={t(item.labelKey)}
                            icon={item.icon}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function AdminNavSubLink({
    to,
    label,
    icon: Icon,
    collapsed,
}: {
    to: '/admin/permissions/function-matrix' | '/admin/permissions/editing'
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
                        'flex items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-xs text-foreground transition-colors',
                        !isActive && 'text-muted-foreground',
                        collapsed && 'justify-center px-2 py-2 text-sm',
                    )}
                >
                    {collapsed && <Icon className="size-4 shrink-0" />}
                    {!collapsed && (
                        <span className="whitespace-nowrap overflow-hidden">{label}</span>
                    )}
                </div>
            )}
        </Link>
    )
}
