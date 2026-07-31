import { describe, expect, it } from 'vitest'

import {
  hasArchiveBorrowRequestPermission,
  hasArchiveBorrowReviewPermission,
} from '@/features/archive-borrow/lib/archiveBorrowAccess'

describe('archiveBorrowAccess', () => {
  it('grants request permission by exact key or module wildcard', () => {
    expect(hasArchiveBorrowRequestPermission(['archive.borrow.request'])).toBe(
      true,
    )
    expect(hasArchiveBorrowRequestPermission(['archive.borrow.*'])).toBe(true)
    expect(hasArchiveBorrowRequestPermission(['*'])).toBe(true)
    expect(hasArchiveBorrowRequestPermission(['archive.warehouse.read'])).toBe(
      false,
    )
  })

  it('grants review permission independently', () => {
    expect(hasArchiveBorrowReviewPermission(['archive.borrow.review'])).toBe(
      true,
    )
    expect(hasArchiveBorrowReviewPermission(['archive.borrow.request'])).toBe(
      false,
    )
  })
})
