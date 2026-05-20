import 'nprogress/nprogress.css'

import { useIsFetching } from '@tanstack/react-query'
import NProgress from 'nprogress'
import { useEffect } from 'react'

export function GlobalLoader() {
  // Exclude queries with meta.globalLoading === false from triggering progress bar
  const isFetching = useIsFetching({
    predicate: (query) => {
      const meta = query.options.meta as { globalLoading?: boolean } | undefined
      return meta?.globalLoading !== false
    },
  })

  // Only show global loading bar when there are active queries that haven't opted out
  const isLoading = isFetching > 0

  useEffect(() => {
    if (isLoading) {
      NProgress.start()
    } else {
      NProgress.done()
    }

    // Cleanup on unmount
    return () => {
      NProgress.done()
    }
  }, [isLoading])

  return null
}
