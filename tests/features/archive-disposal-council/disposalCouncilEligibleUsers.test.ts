import { describe, expect, it } from 'vitest'

import { intersectUsersByPermissionLists } from '@/features/archive-disposal-council/lib/disposalCouncilEligibleUsers'
import type { UserT } from '@/features/auth/types'

function user(id: string, name: string): UserT {
  return {
    id,
    email: `${id}@example.com`,
    fullName: name,
    avatarUrl: null,
    dateOfBirth: null,
    gender: null,
    phone: null,
    address: null,
    lastLoginAt: '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  }
}

describe('intersectUsersByPermissionLists', () => {
  it('returns users present in every list', () => {
    const listA = [user('1', 'An'), user('2', 'Binh')]
    const listB = [user('2', 'Binh B'), user('3', 'Cuong')]
    const listC = [user('2', 'Binh C'), user('4', 'Dung')]

    const result = intersectUsersByPermissionLists([listA, listB, listC])

    expect(result.map((u) => u.id)).toEqual(['2'])
    expect(result[0]?.fullName).toBe('Binh')
  })

  it('returns empty when any list is empty', () => {
    expect(intersectUsersByPermissionLists([[user('1', 'A')], []])).toEqual([])
  })

  it('returns empty for no lists', () => {
    expect(intersectUsersByPermissionLists([])).toEqual([])
  })
})
