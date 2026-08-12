import type { LucideIcon } from 'lucide-react'
import {
  FileStack,
  LayoutDashboard,
  Library,
  Settings2,
  Warehouse,
} from 'lucide-react'

import {
  ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS,
  WAREHOUSE_MANAGEMENT_RELATED_PATHS,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { DIGITIZATION_HUB_RELATED_PATHS } from '@/features/navigation/lib/digitizationHubAccess'
import { SYSTEM_ADMIN_HUB_RELATED_PATHS } from '@/features/navigation/lib/systemAdminHubAccess'
import { DIGITIZATION_SCREEN_REQUIREMENTS } from '@/features/digitization/lib/digitizationAccess'
import { PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/project-management/lib/projectManagementAccess'
import type {
  AppScreenPermissionRequirement,
  AppScreenTo,
} from '@/features/navigation/config/appNav'
import { DATA_CONFIG_RELATED_PATHS } from '@/features/data-config/lib/dataConfigAccess'
import { DASHBOARD_SCREEN_REQUIREMENTS } from '@/features/permissions/lib/dashboardAccess'

export type NavLabelKey =
  | 'admin.dashboard'
  | 'admin.library'
  | 'admin.groups.digitization'
  | 'admin.projectManagement'
  | 'admin.digitization'
  | 'admin.groups.systemAdmin'
  | 'admin.groups.warehouse'
  | 'admin.warehouseManagement'
  | 'admin.physicalWarehouse'
  | 'admin.archiveWarehouse'
  | 'admin.dataConfig.title'

export type NavLinkNode = {
  type: 'link'
  id: string
  to: AppScreenTo
  labelKey: NavLabelKey
  icon?: LucideIcon
  requiredPermission?: AppScreenPermissionRequirement
  relatedPaths?: ReadonlyArray<string>
  /** Special visibility (data-config tiles, warehouse admin bypass). */
  visibilityTag?: 'data-config' | 'archive-warehouse-admin'
}

export type NavGroupNode = {
  type: 'group'
  id: string
  labelKey: NavLabelKey
  icon: LucideIcon
  children: Array<NavLinkNode>
}

export type NavNode = NavLinkNode | NavGroupNode

export const APP_NAV_TREE: Array<NavNode> = [
  {
    type: 'link',
    id: 'dashboard',
    to: '/app/dashboard',
    labelKey: 'admin.dashboard',
    icon: LayoutDashboard,
    requiredPermission: [...DASHBOARD_SCREEN_REQUIREMENTS],
    relatedPaths: ['/app/dashboard'],
  },
  {
    type: 'group',
    id: 'digitization-group',
    labelKey: 'admin.groups.digitization',
    icon: FileStack,
    requiredPermission: [
      ...PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS,
      ...DIGITIZATION_SCREEN_REQUIREMENTS,
    ],
    relatedPaths: [...DIGITIZATION_HUB_RELATED_PATHS],
  },
  {
    type: 'link',
    id: 'warehouse-management',
    to: '/app/warehouse-management',
    labelKey: 'admin.warehouseManagement',
    icon: Warehouse,
    requiredPermission: [
      ...ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS,
      {
        module: 'physical-warehouse',
        permissionKey: 'physical-warehouse.item.read',
      },
    ],
    relatedPaths: [...WAREHOUSE_MANAGEMENT_RELATED_PATHS],
  },
  {
    type: 'link',
    id: 'library',
    to: '/app/library',
    labelKey: 'admin.library',
    icon: Library,
    relatedPaths: ['/app/library', '/app/archive-borrow'],
  },
  {
    type: 'group',
    id: 'system-admin-group',
    labelKey: 'admin.groups.systemAdmin',
    icon: Settings2,
    children: [
      {
        type: 'link',
        id: 'general-catalog',
        to: '/app/general-catalog',
        labelKey: 'admin.generalCatalog.title',
        requiredPermission: [...GENERAL_CATALOG_SCREEN_REQUIREMENTS],
        relatedPaths: [...GENERAL_CATALOG_RELATED_PATHS],
      },
      {
        type: 'link',
        id: 'users',
        to: '/app/users',
        labelKey: 'admin.users',
        requiredPermission: [
          { module: 'users', permissionKey: 'users.read' },
        ],
        relatedPaths: ['/app/users', '/app/user-management'],
      },
      {
        type: 'link',
        id: 'permissions',
        to: '/app/permissions/function-matrix',
        labelKey: 'admin.permissions',
        requiredPermission: { module: 'roles' },
        relatedPaths: ['/app/permissions'],
      },
      {
        type: 'link',
        id: 'audit-logs',
        to: '/app/audit-logs',
        labelKey: 'admin.auditLogs',
        requiredPermission: {
          module: 'audit_logs',
          permissionKey: 'audit_logs.read',
        },
        relatedPaths: ['/app/audit-logs'],
      },
      {
        type: 'link',
        id: 'data-config',
        to: '/app/data-config',
        labelKey: 'admin.dataConfig.title',
        visibilityTag: 'data-config',
        relatedPaths: [...DATA_CONFIG_RELATED_PATHS],
      },
    ],
  },
]

export function collectNavLinkNodes(nodes: Array<NavNode>): Array<NavLinkNode> {
  const links: Array<NavLinkNode> = []
  for (const node of nodes) {
    if (node.type === 'link') {
      links.push(node)
    } else {
      links.push(...node.children)
    }
  }
  return links
}

export function getNavRoutesForLink(link: NavLinkNode): Array<string> {
  const routes = [link.to]
  if (link.relatedPaths?.length) {
    routes.push(...link.relatedPaths)
  }
  return routes
}

export function findActiveNavTrail(pathname: string): {
  group?: NavGroupNode
  link: NavLinkNode
} | null {
  type Candidate = {
    group?: NavGroupNode
    link: NavLinkNode
    score: number
  }
  const candidates: Candidate[] = []

  const scoreLink = (link: NavLinkNode) => {
    let best = 0
    for (const route of getNavRoutesForLink(link)) {
      if (pathname === route || pathname.startsWith(`${route}/`)) {
        best = Math.max(best, route.length)
      }
    }
    return best
  }

  for (const node of APP_NAV_TREE) {
    if (node.type === 'link') {
      const score = scoreLink(node)
      if (score > 0) candidates.push({ link: node, score })
    } else {
      for (const child of node.children) {
        const score = scoreLink(child)
        if (score > 0) candidates.push({ group: node, link: child, score })
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  return { group: best.group, link: best.link }
}
