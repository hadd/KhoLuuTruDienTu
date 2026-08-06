import { describe, expect, it } from 'vitest'

import {
  hasArchiveBorrowReadingPermission,
  hasArchiveBorrowRequestPermission,
  hasArchiveBorrowReviewPermission,
} from '@/features/archive-borrow/lib/archiveBorrowAccess'

describe('archiveBorrowAccess', () => {
  it('grants request permission by exact key or library module wildcard', () => {
    expect(hasArchiveBorrowRequestPermission(['library.borrow.request'])).toBe(
      true,
    )
    expect(hasArchiveBorrowRequestPermission(['library.*'])).toBe(true)
    expect(hasArchiveBorrowRequestPermission(['*'])).toBe(true)
    expect(hasArchiveBorrowRequestPermission(['archive.warehouse.read'])).toBe(
      false,
    )
  })

  it('grants review permission independently', () => {
    expect(hasArchiveBorrowReviewPermission(['library.borrow.review'])).toBe(
      true,
    )
    expect(hasArchiveBorrowReviewPermission(['library.borrow.request'])).toBe(
      false,
    )
  })

  it('grants reading via exploitation or request', () => {
    expect(
      hasArchiveBorrowReadingPermission(['library.exploitation.read']),
    ).toBe(true)
    expect(hasArchiveBorrowReadingPermission(['library.borrow.request'])).toBe(
      true,
    )
    expect(hasArchiveBorrowReadingPermission(['library.borrow.review'])).toBe(
      false,
    )
    expect(hasArchiveBorrowReadingPermission(['library.*'])).toBe(true)
  })
})
