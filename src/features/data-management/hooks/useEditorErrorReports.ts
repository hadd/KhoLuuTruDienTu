import { useCallback, useMemo } from 'react'

import {
  confirmEditorErrorReport,
  forwardEditorErrorReportToManager,
  listEditorErrorReportsByDossier,
  rejectEditorErrorReport,
  submitEditorErrorReport,
} from '@/features/data-management/api/editorErrorReportClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  canEditorSubmitReport,
  canForwardReport,
  canViewerActOnReport,
  getDossierIdsWithPendingReports,
  getEditorPendingReport,
  getLatestRejectedReportForEditor,
  getPendingReportForDossier,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  EditorErrorReportRejectForm,
  EditorErrorReportSubmitForm,
} from '@/features/data-management/schemas'
import { useEditorErrorReportList } from '@/features/data-management/store/editorErrorReportStore'
import type {
  DataDossierMetadataT,
  EditorErrorReportT,
} from '@/features/data-management/types'

export function useEditorErrorReports(role: DataManagementRole) {
  const reports = useEditorErrorReportList()

  const pendingDossierIds = useMemo(
    () => getDossierIdsWithPendingReports(reports, role),
    [reports, role],
  )

  const getPendingForDossier = useCallback(
    (dossierId: string) => getPendingReportForDossier(reports, dossierId, role),
    [reports, role],
  )

  const getEditorPending = useCallback(
    (dossierId: string) => getEditorPendingReport(reports, dossierId),
    [reports],
  )

  const getRejectedForEditor = useCallback(
    (dossierId: string) =>
      getLatestRejectedReportForEditor(reports, dossierId),
    [reports],
  )

  const canSubmit = useCallback(
    (dossierId: string) => canEditorSubmitReport(reports, dossierId),
    [reports],
  )

  const submitReport = useCallback(
    async (input: {
      dossierId: string
      dossierName: string
      metadata: DataDossierMetadataT
      payload: EditorErrorReportSubmitForm
    }) => submitEditorErrorReport(input),
    [],
  )

  const confirmReport = useCallback(
    async (report: EditorErrorReportT) => {
      const nextStatus =
        report.status === 'pending_manager'
          ? 'manager_confirmed'
          : 'qc_confirmed'
      return confirmEditorErrorReport(report.id, nextStatus)
    },
    [],
  )

  const rejectReport = useCallback(
    async (report: EditorErrorReportT, payload: EditorErrorReportRejectForm) => {
      const nextStatus =
        report.status === 'pending_manager' ? 'manager_rejected' : 'qc_rejected'
      return rejectEditorErrorReport(report.id, nextStatus, payload)
    },
    [],
  )

  const forwardReport = useCallback(
    async (report: EditorErrorReportT) =>
      forwardEditorErrorReportToManager(report.id),
    [],
  )

  const canActOnReport = useCallback(
    (report: EditorErrorReportT) => canViewerActOnReport(role, report),
    [role],
  )

  const canForward = useCallback(
    (report: EditorErrorReportT) => canForwardReport(role, report),
    [role],
  )

  const listByDossier = useCallback(
    (dossierId: string) => listEditorErrorReportsByDossier(dossierId),
    [],
  )

  return {
    reports,
    pendingDossierIds,
    getPendingForDossier,
    getEditorPending,
    getRejectedForEditor,
    canSubmit,
    submitReport,
    confirmReport,
    rejectReport,
    forwardReport,
    canActOnReport,
    canForward,
    listByDossier,
  }
}
