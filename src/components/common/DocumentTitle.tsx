import { useMatches, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import { routeTree } from '@/app/routeTree.gen'
import i18n from '@/lib/i18n/config'

/**
 * Normalize routeId by removing trailing slashes
 */
function normalizeRouteId(routeId: string): string {
  return routeId.replace(/\/+$/, '')
}

/**
 * Recursively search for a route by routeId in the route tree
 */
function findRouteById(
  route: any,
  routeId: string,
): { options?: { head?: (args: any) => { title?: string } } } | null {
  if (!route) return null

  // Check if this route matches
  if (route.id === routeId || route.fullPath === routeId) {
    return route
  }

  // Check children
  if (route.children) {
    for (const child of Object.values(route.children)) {
      const found = findRouteById(child as any, routeId)
      if (found) return found
    }
  }

  return null
}

/**
 * Component to set document title based on route head function.
 * This component reads the head function from the current route match
 * and sets document.title accordingly.
 *
 * In SPA environments, HeadContent may not work correctly, so we
 * set document.title directly using useEffect.
 */
export function DocumentTitle() {
  const matches = useMatches()
  const routerInstance = useRouter()
  const routerState = useRouterState({ select: (s) => s })

  useEffect(() => {
    // Get the most specific (deepest) match
    const deepestMatch = matches[matches.length - 1]

    if (!deepestMatch) {
      // Fallback to default title if no matches
      document.title = i18n.t('pageTitles.appName', { ns: 'common' })
      return
    }

    // Try to get head function from route definition
    let headFn:
      | ((args: {
          loaderData: unknown
          params: Record<string, string>
          search: Record<string, unknown>
          context: unknown
        }) => { title?: string })
      | undefined

    // Method 1: Try routerInstance.routeTree.findRouteById
    if (routerInstance && deepestMatch.routeId) {
      const routeId = deepestMatch.routeId
      const normalizedRouteId = normalizeRouteId(routeId)
      if (
        routerInstance &&
        'routeTree' in routerInstance &&
        typeof (routerInstance as any).routeTree?.findRouteById === 'function'
      ) {
        // Try normalized first
        let route = (routerInstance as any).routeTree.findRouteById(
          normalizedRouteId,
        ) as
          | {
              options?: {
                head?: (args: {
                  loaderData: unknown
                  params: Record<string, string>
                  search: Record<string, unknown>
                  context: unknown
                }) => { title?: string }
              }
            }
          | undefined

        // Fallback to original if normalized doesn't exist
        if (!route && routeId !== normalizedRouteId) {
          route = (routerInstance as any).routeTree.findRouteById(routeId) as
            | {
                options?: {
                  head?: (args: {
                    loaderData: unknown
                    params: Record<string, string>
                    search: Record<string, unknown>
                    context: unknown
                  }) => { title?: string }
                }
              }
            | undefined
        }

        headFn = route?.options?.head
      }
    }

    // Method 2: Try routerInstance.routesById (with normalization)
    if (!headFn && routerInstance && deepestMatch.routeId) {
      const routeId = deepestMatch.routeId
      const normalizedRouteId = normalizeRouteId(routeId)

      // Try normalized first (most common case)
      let route = (routerInstance as any).routesById?.[normalizedRouteId] as
        | {
            options?: {
              head?: (args: {
                loaderData: unknown
                params: Record<string, string>
                search: Record<string, unknown>
                context: unknown
              }) => { title?: string }
            }
          }
        | undefined

      // Fallback to original if normalized doesn't exist
      if (!route && routeId !== normalizedRouteId) {
        route = (routerInstance as any).routesById?.[routeId] as
          | {
              options?: {
                head?: (args: {
                  loaderData: unknown
                  params: Record<string, string>
                  search: Record<string, unknown>
                  context: unknown
                }) => { title?: string }
              }
            }
          | undefined
      }

      headFn = route?.options?.head
    }

    // Method 3: Try to access from match object's routeDef property
    if (!headFn) {
      const routeDef = (deepestMatch as any).routeDef as
        | {
            options?: {
              head?: (args: {
                loaderData: unknown
                params: Record<string, string>
                search: Record<string, unknown>
                context: unknown
              }) => { title?: string }
            }
          }
        | undefined

      headFn = routeDef?.options?.head
    }

    // Method 4: Try to access from match object's route property
    if (!headFn) {
      const route = (deepestMatch as any).route as
        | {
            options?: {
              head?: (args: {
                loaderData: unknown
                params: Record<string, string>
                search: Record<string, unknown>
                context: unknown
              }) => { title?: string }
            }
          }
        | undefined

      headFn = route?.options?.head
    }

    // Method 5: Try routeContext
    if (!headFn && deepestMatch.routeContext) {
      const route = (deepestMatch.routeContext as any).route as
        | {
            options?: {
              head?: (args: {
                loaderData: unknown
                params: Record<string, string>
                search: Record<string, unknown>
                context: unknown
              }) => { title?: string }
            }
          }
        | undefined

      headFn = route?.options?.head
    }

    // Method 6: Try routeTree directly (fallback)
    if (!headFn && deepestMatch.routeId) {
      const routeId = deepestMatch.routeId
      const normalizedRouteId = normalizeRouteId(routeId)

      // Try normalized first
      let route = findRouteById(routeTree as any, normalizedRouteId)

      // Fallback to original if normalized doesn't exist
      if (!route && routeId !== normalizedRouteId) {
        route = findRouteById(routeTree as any, routeId)
      }

      if (route) {
        headFn = route.options?.head
      }
    }

    if (headFn) {
      try {
        const headResult = headFn({
          loaderData: deepestMatch.loaderData,
          params: deepestMatch.params as Record<string, string>,
          search: deepestMatch.search as Record<string, unknown>,
          context: deepestMatch.context,
        })

        if (headResult?.title) {
          document.title = headResult.title
          return
        }
      } catch (error) {
        console.warn(
          'Error setting document title from route head function:',
          error,
        )
      }
    }

    // Fallback to default title
    document.title = i18n.t('pageTitles.appName', { ns: 'common' })
  }, [matches, routerInstance, routerState])

  // This component doesn't render anything
  return null
}
