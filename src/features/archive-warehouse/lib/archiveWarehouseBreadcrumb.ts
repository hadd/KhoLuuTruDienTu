import type { ArchiveWarehouseBreadcrumbSegment } from '@/features/archive-warehouse/components/ArchiveWarehouseBreadcrumb'

export function buildHubTabBreadcrumbSegments(input: {
  hubRootLabel: string
  tabLabel: string
  onNavigateHub?: () => void
}): Array<ArchiveWarehouseBreadcrumbSegment> {
  return [
    {
      label: input.hubRootLabel,
      onClick: input.onNavigateHub,
    },
    { label: input.tabLabel },
  ]
}

export function buildDossiersBrowseBreadcrumbSegments(input: {
  hubRootLabel: string
  dossiersTabLabel: string
  browseViewLabel: string
  segments: Array<ArchiveWarehouseBreadcrumbSegment>
  onNavigateHub: () => void
  onNavigateDossiersTab: () => void
  onNavigateBrowseView: () => void
}): Array<ArchiveWarehouseBreadcrumbSegment> {
  return [
    {
      label: input.hubRootLabel,
      onClick: input.onNavigateHub,
    },
    {
      label: input.dossiersTabLabel,
      onClick: input.onNavigateDossiersTab,
    },
    {
      label: input.browseViewLabel,
      onClick: input.onNavigateBrowseView,
    },
    ...input.segments,
  ]
}

export function buildSimplifiedBrowseBreadcrumbSegments(input: {
  listLabel: string
  dossierName?: string
  onNavigateList?: () => void
}): Array<ArchiveWarehouseBreadcrumbSegment> {
  const segments: Array<ArchiveWarehouseBreadcrumbSegment> = [
    {
      label: input.listLabel,
      onClick: input.dossierName ? input.onNavigateList : undefined,
    },
  ]

  if (input.dossierName) {
    segments.push({ label: input.dossierName })
  }

  return segments
}

/** @deprecated Use buildSimplifiedBrowseBreadcrumbSegments */
export function buildFondsDrillDownBreadcrumbSegments(input: {
  fondName: string
  dossierName?: string
  onNavigateFond?: () => void
}): Array<ArchiveWarehouseBreadcrumbSegment> {
  return buildSimplifiedBrowseBreadcrumbSegments({
    listLabel: input.fondName,
    dossierName: input.dossierName,
    onNavigateList: input.onNavigateFond,
  })
}

export function buildListBreadcrumbSegments(
  listLabel: string,
): Array<ArchiveWarehouseBreadcrumbSegment> {
  return [{ label: listLabel }]
}

export function buildDossierDetailBreadcrumbSegments(input: {
  listLabel: string
  dossierName: string
  fileName?: string | null
  onNavigateList: () => void
  onNavigateDossier?: () => void
}): Array<ArchiveWarehouseBreadcrumbSegment> {
  const segments: Array<ArchiveWarehouseBreadcrumbSegment> = [
    { label: input.listLabel, onClick: input.onNavigateList },
    {
      label: input.dossierName,
      onClick: input.fileName ? input.onNavigateDossier : undefined,
    },
  ]

  if (input.fileName) {
    segments.push({ label: input.fileName })
  }

  return segments
}
