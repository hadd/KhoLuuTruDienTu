import { Loader2 } from 'lucide-react'

import { useProfile } from '@/features/auth/hooks'
import { useAuthStore } from '@/features/auth/store'

export function AuthLoadingOverlay() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const hasAccessToken = Boolean(accessToken)
  const { isLoading } = useProfile()

  // Only show overlay when user has token but profile is still loading
  if (!hasAccessToken || !isLoading) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
