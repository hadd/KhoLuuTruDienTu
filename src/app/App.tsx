import '@/lib/i18n/config'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'

import { createQueryClient } from '@/lib/api/queryClient'

import { createAppRouter } from './router'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

function App() {
  console.log('VITE_POSTHOG_HOST:', import.meta.env.VITE_POSTHOG_HOST)
  console.log('All env:', import.meta.env)

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
