import type { NavigateOptions } from '@tanstack/react-router'

import type { AdminIssueReportT } from '@/features/project-manager/types'

export function canNavigateToIssueReportDossier(
  report: AdminIssueReportT,
): boolean {
  return Boolean(report.projectCode?.trim() && report.dossierId?.trim())
}

export function buildIssueReportDossierNavigation(
  report: AdminIssueReportT,
): NavigateOptions | null {
  const projectCode = report.projectCode?.trim()
  const dossierId = report.dossierId?.trim()

  if (!projectCode || !dossierId) {
    return null
  }

  return {
    to: '/app/data',
    replace: true,
    search: {
      projectCode,
      dossierId,
      nodeId: undefined,
      focusDocumentId: undefined,
      focusGroupIndex: undefined,
    },
  }
}
