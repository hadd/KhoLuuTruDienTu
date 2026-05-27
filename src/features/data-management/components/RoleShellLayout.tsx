import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'

import { RoleSidebar } from '@/features/data-management/components/RoleSidebar'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { cn } from '@/lib/utils/cn'

export function RoleShellLayout({ role }: { role: Exclude<DataManagementRole, 'admin'> }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background">
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-[4.5rem]' : 'w-56',
        )}
      >
        <RoleSidebar
          role={role}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
        />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
