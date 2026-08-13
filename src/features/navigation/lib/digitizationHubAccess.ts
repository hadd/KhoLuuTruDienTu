import { DIGITIZATION_RELATED_PATHS } from '@/features/digitization/lib/digitizationAccess'
import { PROJECT_MANAGEMENT_RELATED_PATHS } from '@/features/project-management/lib/projectManagementAccess'

export const DIGITIZATION_HUB_PATH = '/app/digitization-hub' as const

export const DIGITIZATION_HUB_RELATED_PATHS = [
  DIGITIZATION_HUB_PATH,
  ...PROJECT_MANAGEMENT_RELATED_PATHS,
  ...DIGITIZATION_RELATED_PATHS,
] as const
