import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

import { requireAuth } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/admin')({
    beforeLoad: requireAuth,
    component: AdminLayout,
})

function AdminLayout() {
    const { t } = useTranslation('common')

    return (
        <div className="flex min-h-0 w-full flex-1 bg-background">
            <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
                <div className="border-b border-border px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('admin.menuTitle')}
                    </p>
                </div>
                <nav className="flex flex-col gap-1 p-3">
                    <AdminNavLink to="/admin/users" label={t('admin.users')} icon={Users} />
                    <AdminNavLink to="/admin/groups" label={t('admin.groups')} icon={UsersRound} />
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
}: {
    to: '/admin/users' | '/admin/groups'
    label: string
    icon: React.ComponentType<{ className?: string }>
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
        >
            {({ isActive }) => (
                <div
                    className={cn(
                        'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
                        !isActive && 'text-muted-foreground',
                    )}
                >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                </div>
            )}
        </Link>
    )
}