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
    type: 'link',
    id: 'library',
    to: '/app/library',
    labelKey: 'admin.library',
    icon: Library,
    relatedPaths: ['/app/library', '/app/archive-borrow'],
  },
  {
    type: 'link',
    id: 'digitization-hub',
    to: '/app/digitization-hub',
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
    id: 'system-administration',
    to: '/app/system-admin',
    labelKey: 'admin.groups.systemAdmin',
    icon: Settings2,
    relatedPaths: [...SYSTEM_ADMIN_HUB_RELATED_PATHS],
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
