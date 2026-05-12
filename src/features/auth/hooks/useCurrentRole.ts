import { useAuthStore } from '../store'

export function useCurrentRole() {
  return useAuthStore(
    (state) => state.user?.userRoles.find((role) => role.isCurrent) ?? null,
  )
}
