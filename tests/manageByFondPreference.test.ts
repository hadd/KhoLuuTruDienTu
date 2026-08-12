import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  readManageByFondPreference,
  writeManageByFondPreference,
} from '@/features/archive-warehouse/lib/manageByFondPreference'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('manageByFondPreference', () => {
  it('defaults to true when unset', () => {
    expect(readManageByFondPreference(USER_A)).toBe(true)
    expect(readManageByFondPreference(undefined)).toBe(true)
  })

  it('persists per user', () => {
    writeManageByFondPreference(USER_A, false)
    writeManageByFondPreference(USER_B, true)

    expect(readManageByFondPreference(USER_A)).toBe(false)
    expect(readManageByFondPreference(USER_B)).toBe(true)
  })

  it('round-trips false and true', () => {
    writeManageByFondPreference(USER_A, false)
    expect(readManageByFondPreference(USER_A)).toBe(false)

    writeManageByFondPreference(USER_A, true)
    expect(readManageByFondPreference(USER_A)).toBe(true)
  })
})
