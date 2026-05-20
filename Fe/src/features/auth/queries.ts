import { queryOptions } from '@tanstack/react-query'

import { getProfile } from './api/authClient'
import type { UserT } from './types'

export const profileQueryKey = ['auth', 'profile'] as const

export const profileQueryOptions = queryOptions({
  queryKey: profileQueryKey,
  queryFn: async (): Promise<UserT> => {
    return await getProfile()
  },
  // Note: enabled condition is set at hook level (useProfile) for reactivity
  staleTime: 10 * 60 * 1000, // 10 minutes
})
