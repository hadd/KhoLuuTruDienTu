import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { logout } from '@/features/auth/api/authClient'
import { authStore } from '@/features/auth/store'
import { resetDataManagementClientCache } from '@/features/data-management/api/dataManagementClient'
import { disconnectDossierSocket } from '@/features/data-management/lib/dossierSocket'
import { clearAllSecurityAccessTokens } from '@/features/security-level/lib/securityAccessTokenStore'

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      try {
        await logout()
      } catch {
        // Always clear client state even if server logout fails
      }
    },
    onSettled: () => {
      disconnectDossierSocket()
      resetDataManagementClientCache()
      clearAllSecurityAccessTokens()
      queryClient.cancelQueries()
      queryClient.clear()
      authStore.reset()
      navigate({ to: '/login' })
    },
  })
}
