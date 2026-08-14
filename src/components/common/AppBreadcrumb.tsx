import { Link, useMatches, useRouterState } from '@tanstack/react-router'
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
import {
  GENERAL_CATALOG_HUB_PATH,
  getGeneralCatalogHubLabel,
  getGeneralCatalogLeafLabel,
  isGeneralCatalogChildPath,
} from '@/features/general-catalog/lib/generalCatalogBreadcrumb'
import { findActiveNavTrail } from '@/features/navigation/config/appNavTree'
import {
  getHubTabBreadcrumb,
  normalizeAppPath,
} from '@/features/navigation/lib/hubTabBreadcrumb'

type CrumbParent = {
  label: string
  to: string
  search?: Record<string, unknown>
}

type DisplayCrumb = {
  id: string
  label: string
  path: string
  search?: Record<string, unknown>
  icon?: ReactNode
  parents: Array<CrumbParent>
}

export function AppBreadcrumb() {
  const matches = useMatches()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search })
  const { t } = useTranslation('common')
  useTranslation('digitization')
  useTranslation('project-management')
  useTranslation('archive-warehouse')
  useTranslation('data-config')
  useTranslation('general-catalog')

  const translateLabel = (label: string): string => {
    const translationKey = `breadcrumbs.${label}`
    const translated = t(translationKey, { defaultValue: label })
    return translated === translationKey ? label : translated
  }

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

      if (typeof crumbResult === 'string') {
        return {
          match,
          crumbData: {
            id: match.id,
            label: translateLabel(crumbResult),
            path: match.pathname,
            parents: [] as Array<CrumbParent>,
          },
        }
      }

      const objectCrumb = crumbResult as {
        label: string
        icon?: ReactNode
        to?: string
        search?: Record<string, unknown>
        parent?: CrumbParent
        parents?: Array<CrumbParent>
      }

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

  const reversedMatches = [...matchesWithCrumbs].reverse()
  const includedParentPaths = new Set<string>()

  reversedMatches.forEach(({ crumbData }) => {
    crumbData.parents.forEach((parent) => {
      includedParentPaths.add(parent.to)
    })
  })

  const crumbs = matchesWithCrumbs
    .filter(({ match, crumbData }) => {
      if (match.id === reversedMatches[0]?.match.id) {
        return true
      }

      const matchPathname = match.pathname
      const crumbPath = crumbData.path
      return (
        !includedParentPaths.has(matchPathname) &&
        !includedParentPaths.has(crumbPath)
      )
    })
    .map(({ crumbData }) => crumbData)

  const navTrail = findActiveNavTrail(pathname)
  const navGroupLabel = navTrail?.group
    ? t(navTrail.group.labelKey)
    : undefined
  const navLinkLabel = navTrail ? t(navTrail.link.labelKey) : undefined
  const currentPath = normalizeAppPath(pathname)
  const navLinkPath = navTrail ? normalizeAppPath(navTrail.link.to) : undefined
  const navLinkIsCurrent = Boolean(navLinkPath && currentPath === navLinkPath)

  const existingLabels = new Set(
    crumbs.flatMap((crumb) => [
      crumb.label,
      ...crumb.parents.map((parent) => parent.label),
    ]),
  )

  let displayCrumbs: Array<DisplayCrumb> =
    crumbs.length > 0
      ? crumbs
      : navLinkLabel
        ? [
            {
              id: 'nav-current',
              label: navLinkLabel,
              path: navTrail?.link.to ?? pathname,
              parents: [],
            },
          ]
        : []

  if (
    navTrail &&
    navLinkLabel &&
    !navLinkIsCurrent &&
    !existingLabels.has(navLinkLabel) &&
    displayCrumbs.every((crumb) => crumb.label !== navLinkLabel)
  ) {
    displayCrumbs = [
      {
        id: 'nav-hub',
        label: navLinkLabel,
        path: navTrail.link.to,
        parents: [],
      },
      ...displayCrumbs,
    ]
  }

  const catalogHubLabel = getGeneralCatalogHubLabel()
  const catalogLeafLabel = getGeneralCatalogLeafLabel(currentPath)
  if (isGeneralCatalogChildPath(currentPath) && catalogLeafLabel) {
    const leading = displayCrumbs.filter(
      (crumb) =>
        crumb.id === 'nav-hub' ||
        (navLinkLabel != null && crumb.label === navLinkLabel),
    )
    displayCrumbs = [
      ...leading,
      {
        id: 'general-catalog-hub',
        label: catalogHubLabel,
        path: GENERAL_CATALOG_HUB_PATH,
        parents: [],
      },
      {
        id: 'general-catalog-leaf',
        label: catalogLeafLabel,
        path: pathname,
        parents: [],
      },
    ]
  } else {
    const extraCrumbs = getHubTabBreadcrumb(pathname, search)
    for (const [index, tabCrumb] of extraCrumbs.entries()) {
      if (displayCrumbs.some((crumb) => crumb.label === tabCrumb.label)) {
        continue
      }
      displayCrumbs = [
        ...displayCrumbs,
        {
          id: `hub-tab-${index}`,
          label: tabCrumb.label,
          path: pathname,
          parents: [],
        },
      ]
    }
  }

  const showGroupParent =
    Boolean(navGroupLabel) &&
    !existingLabels.has(navGroupLabel!) &&
    displayCrumbs.every((crumb) => crumb.label !== navGroupLabel)

  if (displayCrumbs.length === 0 && !showGroupParent) {
    return null
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        {showGroupParent ? (
          <>
            <BreadcrumbItem className="shrink-0">
              <span className="text-muted-foreground">{navGroupLabel}</span>
            </BreadcrumbItem>
            {displayCrumbs.length > 0 ? <BreadcrumbSeparator /> : null}
          </>
        ) : null}

        {displayCrumbs.map((crumb, index) => {
          const isLast = index === displayCrumbs.length - 1
          const parents = crumb.parents || []

          return (
            <Fragment key={crumb.id}>
              {parents.map((parent, parentIndex) => (
                <Fragment key={parentIndex}>
                  <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink asChild>
                      <Link to={parent.to} search={parent.search}>
                        {parent.label}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ))}
              <BreadcrumbItem className={isLast ? 'min-w-0' : 'shrink-0'}>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-1.5 truncate font-semibold text-foreground">
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.path}
                      search={crumb.search}
                      className="flex items-center gap-1.5"
                    >
                      {crumb.icon}
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
