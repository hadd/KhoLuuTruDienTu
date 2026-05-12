import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useLocation,
} from '@tanstack/react-router'
import { Toaster } from 'sonner'

import { AppDevtools } from '@/components/common/AppDevtools'
import { AuthLoadingOverlay } from '@/components/common/AuthLoadingOverlay'
import { DocumentTitle } from '@/components/common/DocumentTitle'
import { GlobalLoader } from '@/components/common/GlobalLoader'
import { Button } from '@/components/ui/button'
import { AuthenticationError } from '@/lib/api/apiClient'
import i18n from '@/lib/i18n/config'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    title: i18n.t('pageTitles.appName', { ns: 'common' }),
  }),
  component: RootLayout,
  errorComponent: ({ error, reset }) => {
    // Check if it's an authentication error - redirect immediately to login
    if (error instanceof AuthenticationError) {
      // Use window.location.href for immediate redirect without showing error UI
      window.location.href = '/login'
      return null
    }

    // For other errors, show the error UI
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold text-destructive">
            Oops! Something went wrong
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred'}
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={reset} variant="default">
              Try Again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    )
  },
})

function RootLayout() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  // For authenticated pages, the layout is handled by DashboardLayout in the route component
  // For login page, use simple layout
  if (isLoginPage) {
    return (
      <>
        <DocumentTitle />
        <HeadContent />
        <div className="min-h-screen bg-background text-foreground">
          <GlobalLoader />
          <main className="flex-1">
            <Outlet />
          </main>
          <Toaster closeButton duration={3000} position="bottom-left" />
          <AppDevtools />
        </div>
      </>
    )
  }

  // For authenticated routes, just render outlet (layout handled in route components)
  return (
    <>
      <DocumentTitle />
      <HeadContent />
      <GlobalLoader />
      <AuthLoadingOverlay />
      <Outlet />
      <Toaster closeButton duration={3000} position="bottom-left" />
      <AppDevtools />
    </>
  )
}
