import type { PermissionCatalogItemT } from '@/features/permissions/types'

export type SubSubModuleGroup = {
  id: string
  label: string
  modules: string[]
}

export type SubModuleGroup = {
  id: string
  label: string
  modules?: string[]
  groups?: SubSubModuleGroup[]
}

export type MajorModuleGroup = {
  id: string
  label: string
  subModules: SubModuleGroup[]
}

export const PERMISSION_HIERARCHY: MajorModuleGroup[] = [
  {
    id: 'dashboard',
    label: 'TỔNG QUAN',
    subModules: [
      {
        id: 'dashboard-sub',
        label: 'Dashboard / Tổng quan',
        modules: ['dashboard'],
      },
    ],
  },
  {
    id: 'digitization',
    label: 'SỐ HÓA',
    subModules: [
      {
        id: 'projects',
        label: 'Quản lý dự án',
        modules: ['projects'],
      },
      {
        id: 'project-plans',
        label: 'Kế hoạch dự án',
        modules: ['project-plans'],
      },
      {
        id: 'groups',
        label: 'Quản lý nhóm làm việc',
        modules: ['groups'],
      },
      {
        id: 'scan-intake',
        label: 'Quét tài liệu (Scan Intake)',
        modules: ['scan-intake'],
      },
      {
        id: 'data-entry',
        label: 'Nhập liệu & Duyệt QC',
        modules: ['data-entry'],
      },
      {
        id: 'dossiers',
        label: 'Quản lý hồ sơ',
        modules: ['dossiers'],
      },
      {
        id: 'folders',
        label: 'Cây thư mục',
        modules: ['folders'],
      },
    ],
  },
  {
    id: 'warehouse',
    label: 'QUẢN LÝ KHO',
    subModules: [
      {
        id: 'archive-warehouse',
        label: 'Kho số (Archive Warehouse)',
        modules: ['archive.warehouse', 'archive_warehouse'],
      },
      {
        id: 'archive-submit-review',
        label: 'Nộp & Duyệt lưu kho',
        modules: ['archive'],
      },
      {
        id: 'physical-warehouse',
        label: 'Kho vật lý',
        modules: ['physical-warehouse'],
      },
      {
        id: 'archive-disposal',
        label: 'Hủy hồ sơ hết hạn',
        modules: ['archive.disposal'],
      },
    ],
  },
  {
    id: 'exploitation',
    label: 'KHAI THÁC DỮ LIỆU',
    subModules: [
      {
        id: 'library',
        label: 'Khai thác & Mượn trả tài liệu',
        modules: ['library'],
      },
    ],
  },
  {
    id: 'system-admin',
    label: 'QUẢN TRỊ HỆ THỐNG',
    subModules: [
      {
        id: 'users',
        label: 'Quản lý người dùng',
        modules: ['users'],
      },
      {
        id: 'roles',
        label: 'Phân quyền hệ thống',
        modules: ['roles'],
      },
      {
        id: 'audit-logs',
        label: 'Nhật ký thao tác',
        modules: ['audit_logs'],
      },
      {
        id: 'general-catalog',
        label: 'Danh mục dùng chung',
        groups: [
          {
            id: 'fonds',
            label: 'Quản lý phông lưu trữ',
            modules: ['fonds'],
          },
          {
            id: 'retention-periods',
            label: 'Quản lý thời hạn lưu trữ',
            modules: ['retention-periods'],
          },
          {
            id: 'inventories',
            label: 'Quản lý mục lục',
            modules: ['inventories'],
          },
          {
            id: 'dossier-types',
            label: 'Quản lý loại hồ sơ',
            modules: ['dossier-types'],
          },
          {
            id: 'security-levels',
            label: 'Cấp độ bảo mật',
            modules: ['security-levels'],
          },
        ],
      },
      {
        id: 'data-config',
        label: 'Cấu hình dữ liệu',
        groups: [
          {
            id: 'document-types',
            label: 'Cấu hình loại tài liệu',
            modules: ['document-types'],
          },
          {
            id: 'metadata',
            label: 'Phân công & Mẫu metadata',
            modules: ['metadata'],
          },
          {
            id: 'notifications',
            label: 'Cấu hình thông báo',
            modules: ['notifications'],
          },
          {
            id: 'watermark',
            label: 'Cấu hình Watermark',
            modules: ['watermark'],
          },
        ],
      },
    ],
  },
]

/** Get list of all module keys under a sub-module or sub-sub-module node */
export function collectModuleKeysFromSubGroup(sub: SubModuleGroup): string[] {
  if (sub.modules?.length) return sub.modules
  if (sub.groups?.length) {
    return sub.groups.flatMap((g) => g.modules)
  }
  return []
}

/** Get list of all module keys under a major module */
export function collectModuleKeysFromMajorGroup(major: MajorModuleGroup): string[] {
  return major.subModules.flatMap((sub) => collectModuleKeysFromSubGroup(sub))
}

/** Helper to filter catalog items belonging to given module keys */
export function getCatalogItemsForModules(
  catalog: PermissionCatalogItemT[],
  moduleKeys: string[],
): PermissionCatalogItemT[] {
  const set = new Set(moduleKeys)
  return catalog.filter((item) => set.has(item.module))
}
