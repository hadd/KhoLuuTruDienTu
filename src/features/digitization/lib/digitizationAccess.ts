import { DATA_ENTRY_SCREEN_REQUIREMENTS } from '@/features/data-management/lib/resolveDataManagementRole'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const DIGITIZATION_SCREEN_REQUIREMENTS = [
  { module: 'scan-intake', permissionKey: 'scan-intake.use' },
  ...DATA_ENTRY_SCREEN_REQUIREMENTS,
] as const satisfies Array<ScreenPermissionRequirement>

/** Landing hub + các màn con thuộc menu Số hóa hồ sơ, tài liệu. */
export const DIGITIZATION_RELATED_PATHS = [
  '/app/digitization',
  '/app/scan-intake',
  '/app/data',
] as const
