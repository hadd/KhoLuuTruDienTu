import { BarChart3, ClipboardCheck, PenLine, type LucideIcon } from 'lucide-react'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'

export type EditorSidebarRoute = '/editor/data' | '/editor/review' | '/editor/kpi'
export type QcSidebarRoute = '/qc/data' | '/qc/kpi'

export interface RoleSidebarNavItem {
  to: EditorSidebarRoute | QcSidebarRoute
  labelKey: 'sidebar.items.editing' | 'sidebar.items.review' | 'sidebar.items.kpiReport'
  icon: LucideIcon
}

export const roleSidebarNavItems: Record<
  Exclude<DataManagementRole, 'admin'>,
  RoleSidebarNavItem[]
> = {
  editor: [
    {
      to: '/editor/data',
      labelKey: 'sidebar.items.editing',
      icon: PenLine,
    },
    {
      to: '/editor/review',
      labelKey: 'sidebar.items.review',
      icon: ClipboardCheck,
    },
    {
      to: '/editor/kpi',
      labelKey: 'sidebar.items.kpiReport',
      icon: BarChart3,
    },
  ],
  qc: [
    {
      to: '/qc/data',
      labelKey: 'sidebar.items.review',
      icon: ClipboardCheck,
    },
    {
      to: '/qc/kpi',
      labelKey: 'sidebar.items.kpiReport',
      icon: BarChart3,
    },
  ],
}
