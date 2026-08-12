import { describe, expect, it } from 'vitest'

import { appendQueryValues } from '@/lib/api/query-params'

describe('appendQueryValues', () => {
  it('serializes multiple ids with bracket notation', () => {
    const params = new URLSearchParams()
    appendQueryValues(params, 'fondId', ['fond-a', 'fond-b'])

    expect(params.toString()).toBe('fondId%5B%5D=fond-a&fondId%5B%5D=fond-b')
  })

  it('serializes a single id with bracket notation', () => {
    const params = new URLSearchParams()
    appendQueryValues(params, 'fondId', 'fond-a')

    expect(params.toString()).toBe('fondId%5B%5D=fond-a')
  })
})
