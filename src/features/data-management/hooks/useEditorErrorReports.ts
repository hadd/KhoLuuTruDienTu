import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { useAuthStore } from '@/features/auth/store'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  canEditorSubmitReport,
  canForwardReport,
  canViewerActOnReport,
  getEditorPendingReport,
  getLatestRejectedReportForEditor,
  getPendingReportsForDossier,
  getReportsForDossierReview,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  EditorErrorReportRejectForm,
  EditorErrorReportSubmitForm,
} from '@/features/data-management/schemas'
import {
  issueReportsByDossierQueryOptions,
  useConfirmIssueReportMutation,
  useEscalateIssueReportMutation,
  useRejectIssueReportMutation,
  useSubmitEditorErrorReportMutation,
} from '@/features/data-management/queries'
import type {
  DataDossierMetadataT,
  EditorErrorReportT,
} from '@/features/data-management/types'

export function useEditorErrorReports(
  role: DataManagementRole,
  options?: {
    dossierId?: string
    dossierName?: string
    projectCode?: string
  },
) {
  const dossierId = options?.dossierId?.trim() ?? ''
  const dossierName = options?.dossierName?.trim() ?? ''
  const reporterId = useAuthStore((state) => state.user?.id ?? 'anonymous')

  const reportsQuery = useQuery(
    issueReportsByDossierQueryOptions(dossierId, dossierName),
  )

  const confirmMutation = useConfirmIssueReportMutation(
    role,
    options?.projectCode,
  )
  const rejectMutation = useRejectIssueReportMutation(role, options?.projectCode)
  const escalateMutation = useEscalateIssueReportMutation(
    role,
    options?.projectCode,
  )
  const submitMutation = useSubmitEditorErrorReportMutation(
    role,
    options?.projectCode,
  )

  const reports = reportsQuery.data ?? []

  const pendingReportsForDossier = useMemo(
    () =>
      dossierId
        ? getPendingReportsForDossier(reports, dossierId, role)
        : [],
    [reports, dossierId, role],
  )

  const reportsForDossierReview = useMemo(
    () =>
      dossierId
        ? getReportsForDossierReview(reports, dossierId, role)
        : [],
    [reports, dossierId, role],
  )

  const getPendingForDossier = useCallback(
    (targetDossierId: string) =>
      getPendingReportsForDossier(reports, targetDossierId, role),
    [reports, role],
  )

  const getEditorPending = useCallback(
    (targetDossierId: string) =>
      getEditorPendingReport(reports, targetDossierId, reporterId),
    [reports, reporterId],
  )

  const getRejectedForEditor = useCallback(
    (targetDossierId: string) =>
      getLatestRejectedReportForEditor(reports, targetDossierId, reporterId),
    [reports, reporterId],
  )

  const canSubmit = useCallback(
    (targetDossierId: string) =>
      canEditorSubmitReport(reports, targetDossierId, reporterId),
    [reports, reporterId],
  )

  const submitReport = useCallback(
    async (input: {
      dossierId: string
      dossierName: string
      metadata: DataDossierMetadataT
      payload: EditorErrorReportSubmitForm
    }) => {
      await submitMutation.mutateAsync({
        ...input,
        reporterId,
        existingReports: reports,
      })
    },
    [reports, reporterId, submitMutation],
  )

  const confirmReport = useCallback(
    async (report: EditorErrorReportT) => {
      await confirmMutation.mutateAsync({
        reportId: report.id,
        dossierId: report.dossierId,
      })
    },
    [confirmMutation],
  )

  const rejectReport = useCallback(
    async (report: EditorErrorReportT, payload: EditorErrorReportRejectForm) => {
      await rejectMutation.mutateAsync({
        reportId: report.id,
        dossierId: report.dossierId,
        rejectNote: payload.rejectNote,
        rejectFields: payload.rejectFields,
      })
    },
    [rejectMutation],
  )

  const forwardReport = useCallback(
    async (report: EditorErrorReportT) => {
      await escalateMutation.mutateAsync({
        reportId: report.id,
        dossierId: report.dossierId,
      })
    },
    [escalateMutation],
  )

  const canActOnReport = useCallback(
    (report: EditorErrorReportT) => canViewerActOnReport(role, report),
    [role],
  )

  const canForward = useCallback(
    (report: EditorErrorReportT) => canForwardReport(role, report),
    [role],
  )

  const isActionPending =
    confirmMutation.isPending ||
    rejectMutation.isPending ||
    escalateMutation.isPending ||
    submitMutation.isPending

  return {
    reports,
    pendingReportsForDossier,
    reportsForDossierReview,
    isLoading: reportsQuery.isLoading,
    isActionPending,
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
    refetchReports: reportsQuery.refetch,
  }
}
