import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
  ARCHIVE_WAREHOUSE_PERMISSIONS,
  canConfigureArchiveWarehouseSecurity,
  canEditArchiveWarehouse,
  hasArchiveWarehousePermission,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'

describe('archive warehouse configure security permission', () => {
  it('recognizes configure_security as a warehouse permission', () => {
    expect(
      hasArchiveWarehousePermission(
        [ARCHIVE_WAREHOUSE_PERMISSIONS.configureSecurity],
        ARCHIVE_WAREHOUSE_PERMISSIONS.configureSecurity,
      ),
    ).toBe(true)
  })

  it('does not treat edit as configure_security', () => {
    expect(canEditArchiveWarehouse([ARCHIVE_WAREHOUSE_PERMISSIONS.edit])).toBe(
      true,
    )
    expect(
      canConfigureArchiveWarehouseSecurity([
        ARCHIVE_WAREHOUSE_PERMISSIONS.edit,
      ]),
    ).toBe(false)
  })

  it('includes configure_security in dossier screen access requirements', () => {
    expect(
      ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS.some(
        (req) =>
          req.permissionKey ===
          ARCHIVE_WAREHOUSE_PERMISSIONS.configureSecurity,
      ),
    ).toBe(true)
  })
})
