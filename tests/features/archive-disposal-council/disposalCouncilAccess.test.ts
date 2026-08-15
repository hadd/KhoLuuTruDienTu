import { describe, expect, it } from 'vitest'

import {
  hasDisposalCouncilCreatePermission,
  hasDisposalCouncilReadPermission,
  hasDisposalCouncilUpdatePermission,
  hasDisposalCouncilFinalizePermission,
  hasDisposalDestroyPermission,
  hasDisposalSettingsReadPermission,
  hasDisposalSettingsUpdatePermission,
} from '@/features/archive-disposal-council/lib/disposalCouncilAccess'

describe('disposal council permissions', () => {
  it('splits council permissions without manage alias', () => {
    expect(hasDisposalCouncilReadPermission(['archive.disposal.council.read'])).toBe(
      true,
    )
    expect(hasDisposalCouncilCreatePermission(['archive.disposal.council.create'])).toBe(
      true,
    )
    expect(hasDisposalCouncilUpdatePermission(['archive.disposal.council.update'])).toBe(
      true,
    )
    expect(
      hasDisposalCouncilFinalizePermission(['archive.disposal.council.finalize']),
    ).toBe(true)
    expect(hasDisposalSettingsReadPermission(['archive.disposal.settings.read'])).toBe(
      true,
    )
    expect(hasDisposalSettingsReadPermission(['archive.warehouse.read'])).toBe(true)
    expect(hasDisposalSettingsReadPermission(['archive.disposal.read'])).toBe(true)
    expect(
      hasDisposalSettingsUpdatePermission(['archive.disposal.settings.update']),
    ).toBe(true)
    expect(hasDisposalDestroyPermission(['archive.disposal.destroy'])).toBe(true)
  })

  it('does not grant council create from legacy disposal manage', () => {
    expect(hasDisposalCouncilCreatePermission(['archive.disposal.manage'])).toBe(false)
    expect(hasDisposalDestroyPermission(['archive.disposal.manage'])).toBe(false)
  })
})
