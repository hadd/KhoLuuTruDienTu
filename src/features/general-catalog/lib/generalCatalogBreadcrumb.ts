import i18n from '@/lib/i18n/config'

type GeneralCatalogTileKey =
  | 'tiles.fonds'
  | 'tiles.retention'
  | 'tiles.inventory'
  | 'tiles.dossierType'
  | 'tiles.documentType'
  | 'tiles.securityLevel'

export const GENERAL_CATALOG_HUB_PATH = '/app/general-catalog' as const

export const GENERAL_CATALOG_CHILD_PATHS = [
  '/app/archive-fonds',
  '/app/retention-periods',
  '/app/inventories',
  '/app/dossier-types',
  '/app/document-types',
  '/app/security-levels',
] as const

const CHILD_PATH_TILE_KEYS: Record<
  (typeof GENERAL_CATALOG_CHILD_PATHS)[number],
  GeneralCatalogTileKey
> = {
  '/app/archive-fonds': 'tiles.fonds',
  '/app/retention-periods': 'tiles.retention',
  '/app/inventories': 'tiles.inventory',
  '/app/dossier-types': 'tiles.dossierType',
  '/app/document-types': 'tiles.documentType',
  '/app/security-levels': 'tiles.securityLevel',
}

export function isGeneralCatalogChildPath(pathname: string): boolean {
  return (GENERAL_CATALOG_CHILD_PATHS as ReadonlyArray<string>).includes(
    pathname,
  )
}

export function getGeneralCatalogHubLabel() {
  return i18n.t('admin.generalCatalog.title', { ns: 'common' })
}

export function getGeneralCatalogLeafLabel(pathname: string): string | null {
  const tileKey =
    CHILD_PATH_TILE_KEYS[
      pathname as (typeof GENERAL_CATALOG_CHILD_PATHS)[number]
    ]
  if (!tileKey) return null
  return i18n.t(tileKey, { ns: 'general-catalog' })
}

/** Breadcrumb for catalog child screens: System Admin › Shared catalog › leaf. */
export function generalCatalogChildCrumb(tileKey: GeneralCatalogTileKey) {
  return () => ({
    label: i18n.t(tileKey, { ns: 'general-catalog' }),
    parent: {
      label: getGeneralCatalogHubLabel(),
      to: GENERAL_CATALOG_HUB_PATH,
    },
  })
}
