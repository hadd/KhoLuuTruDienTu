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
import { DIGITIZATION_RELATED_PATHS } from '@/features/digitization/lib/digitizationAccess'
import { DIGITIZATION_SCREEN_REQUIREMENTS } from '@/features/digitization/lib/digitizationAccess'
import { GENERAL_CATALOG_RELATED_PATHS } from '@/features/general-catalog/lib/generalCatalogAccess'
import { GENERAL_CATALOG_SCREEN_REQUIREMENTS } from '@/features/general-catalog/lib/generalCatalogAccess'
import { PROJECT_MANAGEMENT_RELATED_PATHS } from '@/features/project-management/lib/projectManagementAccess'
import { PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/project-management/lib/projectManagementAccess'
import type {
  AppScreenPermissionRequirement,
  AppScreenTo,
} from '@/features/navigation/config/appNav'
import { DATA_CONFIG_NAV_ITEM_DEFS } from '@/features/navigation/config/dataConfigNavItems'
import { DASHBOARD_SCREEN_REQUIREMENTS } from '@/features/permissions/lib/dashboardAccess'

export type NavLabelKey =
  | 'admin.dashboard'
  | 'admin.library'
  | 'admin.groups.digitization'
  | 'admin.projectManagement'
  | 'admin.digitization'
  | 'admin.groups.systemAdmin'
  | 'admin.generalCatalog.title'
  | 'admin.users'
  | 'admin.permissions'
  | 'admin.auditLogs'
  | 'admin.groups.warehouse'
  | 'admin.warehouseManagement'
  | 'admin.physicalWarehouse'
  | 'admin.archiveWarehouse'
  | (typeof DATA_CONFIG_NAV_ITEM_DEFS)[number]['labelKey']

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

const dataConfigNavLinks: Array<NavLinkNode> = DATA_CONFIG_NAV_ITEM_DEFS.map(
  (item) => ({
    type: 'link' as const,
    id: `data-config-${item.id}`,
    to: item.to,
    labelKey: item.labelKey,
    visibilityTag: 'data-config' as const,
    relatedPaths: [item.to],
  }),
)

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
    type: 'group',
    id: 'digitization-group',
    labelKey: 'admin.groups.digitization',
    icon: FileStack,
    children: [
      {
        type: 'link',
        id: 'project-management',
        to: '/app/project-management',
        labelKey: 'admin.projectManagement',
        requiredPermission: [...PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS],
        relatedPaths: [...PROJECT_MANAGEMENT_RELATED_PATHS],
      },
      {
        type: 'link',
        id: 'digitization',
        to: '/app/digitization',
        labelKey: 'admin.digitization',
        requiredPermission: [...DIGITIZATION_SCREEN_REQUIREMENTS],
        relatedPaths: [...DIGITIZATION_RELATED_PATHS],
      },
    ],
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
      ...dataConfigNavLinks,
    ],
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
