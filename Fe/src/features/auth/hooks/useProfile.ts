import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { profileQueryKey, profileQueryOptions } from '../queries'
import { authStore, useAuthStore } from '../store'

export function useProfile() {
  const queryClient = useQueryClient()
  // Use reactive selector to check if access token exists
  const accessToken = useAuthStore((state) => state.accessToken)
  const hasAccessToken = Boolean(accessToken)
  const prevAccessTokenRef = useRef<string | null>(null)

  // Reset query when access token changes (new login) to clear cached data immediately
  useEffect(() => {
    if (
      prevAccessTokenRef.current !== null &&
      prevAccessTokenRef.current !== accessToken
    ) {
      if (accessToken) {
        // New login - reset query to clear old cached data immediately
        queryClient.resetQueries({ queryKey: profileQueryKey })
      } else {
        // Logout - remove queries completely
        queryClient.removeQueries({ queryKey: profileQueryKey })
      }
    }
    prevAccessTokenRef.current = accessToken
  }, [accessToken, queryClient])

  const query = useQuery({
    ...profileQueryOptions,
    enabled: hasAccessToken, // Only fetch when access token exists (reactive)
  })

  // Sync query data to store when it updates
  useEffect(() => {
    if (query.data) {
      authStore.setUser(query.data)
    }
  }, [query.data])

  // Return null user when no access token to prevent stale data display
  // This ensures old user data isn't shown after logout or before new login completes
  const user = hasAccessToken ? (query.data ?? null) : null
  const currentSchoolId = user?.school?.id ?? null
  const currentUserRole =
    user?.userRoles?.find((role) => role.isCurrent) ?? null

  return {
    user,
    currentSchoolId,
    currentUserRole,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
