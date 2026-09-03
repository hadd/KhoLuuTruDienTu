import type { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export const createAppRouter = (queryClient: QueryClient) =>
  createRouter({
    routeTree,
    context: {
      queryClient,
    },
    defaultPreload: 'intent',
    defaultNotFoundComponent: () => (
      <div className="p-8 text-center text-muted-foreground">
        Không tìm thấy trang yêu cầu
      </div>
    ),
  })

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }

  interface StaticDataRouteOption {
    crumb?:
      | string
      | ((data: any) => string)
      | ((data: any) => {
          label: string
          to?: string
          search?: Record<string, unknown>
          parent?: {
            label: string
            to: string
            search?: Record<string, unknown>
          }
          parents?: Array<{
            label: string
            to: string
            search?: Record<string, unknown>
          }>
        })
  }
}
