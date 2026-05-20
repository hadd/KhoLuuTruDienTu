import { Link, useMatches } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export function AppBreadcrumb() {
  const matches = useMatches()
  const { t } = useTranslation('common')

  // Helper function to translate breadcrumb labels
  const translateLabel = (label: string): string => {
    // Try to translate using breadcrumbs namespace
    const translationKey = `breadcrumbs.${label}`
    const translated = t(translationKey, { defaultValue: label })
    // If translation returns the key itself (not found), return original label
    return translated === translationKey ? label : translated
  }

  // First, collect all matches with crumbs and their processed data
  const matchesWithCrumbs = matches
    .map((match) => {
      const staticData = match.staticData as { crumb?: unknown } | undefined
      if (!staticData || !staticData.crumb) {
        return null
      }

      const { crumb } = staticData
      const crumbResult =
        typeof crumb === 'function'
          ? (crumb as (loaderData: unknown) => unknown)(match.loaderData)
          : crumb

      // Support both simple string crumbs and object-based crumbs with optional parent
      if (typeof crumbResult === 'string') {
        return {
          match,
          crumbData: {
            id: match.id,
            label: translateLabel(crumbResult),
            path: match.pathname,
            parents: [],
          },
        }
      }

      const objectCrumb = crumbResult as {
        label: string
        icon?: ReactNode
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
      }

      // Support both single parent (backward compatible) and array of parents
      const parents = objectCrumb.parents
        ? objectCrumb.parents.map((p) => ({
            ...p,
            label: translateLabel(p.label),
          }))
        : objectCrumb.parent
          ? [
              {
                ...objectCrumb.parent,
                label: translateLabel(objectCrumb.parent.label),
              },
            ]
          : []

      return {
        match,
        crumbData: {
          id: match.id,
          label: translateLabel(objectCrumb.label),
          icon: objectCrumb.icon,
          path: objectCrumb.to ?? match.pathname,
          search: objectCrumb.search,
          parents,
        },
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // Reverse to process from deepest (most specific) to shallowest (least specific)
  const reversedMatches = [...matchesWithCrumbs].reverse()

  // Track which parent paths have been included in child routes' parents arrays
  const includedParentPaths = new Set<string>()

  // Collect all parent paths from child routes
  reversedMatches.forEach(({ crumbData }) => {
    crumbData.parents.forEach((parent) => {
      includedParentPaths.add(parent.to)
    })
  })

  // Filter out parent matches that are already represented in child matches' parents arrays
  const crumbs = matchesWithCrumbs
    .filter(({ match, crumbData }) => {
      // Always include the most specific (deepest) match
      if (match.id === reversedMatches[0]?.match.id) {
        return true
      }

      // Skip parent matches if their pathname or crumb path is already in a child's parents array
      const matchPathname = match.pathname
      const crumbPath = crumbData.path
      return (
        !includedParentPaths.has(matchPathname) &&
        !includedParentPaths.has(crumbPath)
      )
    })
    .map(({ crumbData }) => crumbData)

  if (crumbs.length === 0) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" className="flex items-center">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {crumbs.length > 0 && <BreadcrumbSeparator />}

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          const parents =
            (
              crumb as {
                parents?: Array<{
                  label: string
                  to: string
                  search?: Record<string, unknown>
                }>
              }
            ).parents || []

          return (
            <Fragment key={crumb.id}>
              {parents.map((parent, parentIndex) => (
                <Fragment key={parentIndex}>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={parent.to} search={parent.search}>
                        {parent.label}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ))}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    {(crumb as { icon?: ReactNode }).icon}
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.path}
                      search={crumb.search}
                      className="flex items-center gap-1.5"
                    >
                      {(crumb as { icon?: ReactNode }).icon}
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
