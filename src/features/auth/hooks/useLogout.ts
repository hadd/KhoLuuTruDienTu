import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { logout } from '@/features/auth/api/authClient'
import { authStore } from '@/features/auth/store'
import { disconnectDataManagementSocket } from '@/lib/socket/dataManagementSocket'
import { disconnectDossierSocket } from '@/features/data-management/lib/dossierSocket'

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
      disconnectDataManagementSocket()
      disconnectDossierSocket()
      queryClient.cancelQueries()
      queryClient.clear()
      authStore.reset()
      navigate({ to: '/login' })
    },
  })
}
