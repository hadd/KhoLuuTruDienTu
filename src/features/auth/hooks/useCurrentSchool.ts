// import { useQuery } from '@tanstack/react-query'
// import { useEffect } from 'react'

// import { profileQueryOptions } from '../queries'
// import { authStore, useAuthStore } from '../store'

// export function useCurrentSchool() {
//   // Check if user data exists in store
//   const user = useAuthStore((state) => state.user)
//   const hasUserData = Boolean(user?.school?.id)

//   // Only fetch if we don't have user data
//   const query = useQuery({
//     ...profileQueryOptions,
//     enabled: !hasUserData, // Only fetch when data is missing
//   })

//   // Sync query data to store when it updates
//   useEffect(() => {
//     if (query.data) {
//       authStore.setUser(query.data)
//     }
//   }, [query.data])

//   // Return school ID from store (reactive, will update when query completes)
//   return useAuthStore((state) =>
//     state.user?.school ? state.user.school.id : null,
//   )
// }
