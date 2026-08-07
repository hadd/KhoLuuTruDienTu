import type {
  AvailableCatalogForCouncilT,
  DisposalCouncilDecisionDocumentsT,
  DisposalCouncilDetailT,
  DisposalCouncilEvaluationsResponseT,
  DisposalCouncilEvaluationProgressT,
  DisposalCouncilEvaluationDecisionT,
  DisposalCouncilHistoryItemT,
  DisposalCouncilMemberInputT,
  DisposalCouncilSummaryT,
  DisposalSettingsT,
} from '@/features/archive-disposal-council/types'
import type { DisposalProposalCatalogT } from '@/features/archive-disposal/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'

export async function getDisposalSettings(): Promise<DisposalSettingsT> {
  const response = await apiClient.get<DisposalSettingsT>(
    '/api/v1/archive-disposal/settings',
  )
  return response.data
}

export async function updateDisposalSettings(input: {
  councilReviewEnabled: boolean
}): Promise<DisposalSettingsT> {
  const response = await apiClient.patch<DisposalSettingsT>(
    '/api/v1/archive-disposal/settings',
    input,
  )
  return response.data
}

export async function getDisposalCouncils(params?: {
  page?: number
  limit?: number
  catalogId?: string
}): Promise<{
  items: Array<DisposalCouncilSummaryT>
  page: number
  limit: number
  total: number
  totalPages: number
}> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
  })
  if (params?.catalogId) searchParams.set('catalogId', params.catalogId)
  const response = await apiClient.get<{
    items: Array<DisposalCouncilSummaryT>
    page: number
    limit: number
    total: number
    totalPages: number
  }>(`/api/v1/archive-disposal/councils?${searchParams.toString()}`)
  return response.data
}

export async function getDisposalCouncil(councilId: string): Promise<DisposalCouncilDetailT> {
  const response = await apiClient.get<DisposalCouncilDetailT>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}`,
  )
  return response.data
}

export async function getDisposalCouncilHistory(councilId: string): Promise<{
  items: Array<DisposalCouncilHistoryItemT>
}> {
  const response = await apiClient.get<{ items: Array<DisposalCouncilHistoryItemT> }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/history`,
  )
  return response.data
}

export async function getAvailableCatalogsForCouncil(): Promise<{
  items: Array<AvailableCatalogForCouncilT>
}> {
  const response = await apiClient.get<{ items: Array<AvailableCatalogForCouncilT> }>(
    '/api/v1/archive-disposal/catalogs/available-for-council',
  )
  return response.data
}

export async function createDisposalCouncil(input: {
  catalogId: string
  members: Array<DisposalCouncilMemberInputT>
  copiedFromCouncilId?: string | null
}): Promise<DisposalCouncilDetailT> {
  const response = await apiClient.post<DisposalCouncilDetailT>(
    '/api/v1/archive-disposal/councils',
    input,
  )
  return response.data
}

export async function copyDisposalCouncilMembers(
  sourceCouncilId: string,
  input: {
    targetCatalogId: string
    members?: Array<DisposalCouncilMemberInputT>
  },
): Promise<DisposalCouncilDetailT> {
  const response = await apiClient.post<DisposalCouncilDetailT>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(sourceCouncilId)}/copy-members`,
    input,
  )
  return response.data
}

export async function updateDisposalCouncilMembers(
  councilId: string,
  input: {
    members: Array<DisposalCouncilMemberInputT>
    reason?: string
  },
): Promise<DisposalCouncilDetailT> {
  const response = await apiClient.patch<DisposalCouncilDetailT>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/members`,
    input,
  )
  return response.data
}

export async function executeDirectDestroyCatalog(
  catalogId: string,
): Promise<DisposalProposalCatalogT> {
  const response = await apiClient.post<DisposalProposalCatalogT>(
    `/api/v1/archive-disposal/catalogs/${encodeURIComponent(catalogId)}/execute-destroy`,
  )
  return response.data
}

export async function getDisposalCouncilEvaluations(
  councilId: string,
): Promise<DisposalCouncilEvaluationsResponseT> {
  const response = await apiClient.get<DisposalCouncilEvaluationsResponseT>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/evaluations`,
  )
  return response.data
}

export async function upsertDisposalCouncilItemEvaluation(
  councilId: string,
  itemId: string,
  input: {
    decision: DisposalCouncilEvaluationDecisionT
    reason: string
    changeReason?: string
  },
): Promise<{
  success: boolean
  progress: DisposalCouncilEvaluationProgressT
}> {
  const response = await apiClient.put<{
    success: boolean
    progress: DisposalCouncilEvaluationProgressT
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/items/${encodeURIComponent(itemId)}/evaluation`,
    input,
  )
  return response.data
}

export async function setDisposalCouncilMemberAbsent(
  councilId: string,
  userId: string,
  input: { excusedAbsent: boolean; absentReason?: string },
): Promise<{ success: boolean; progress: DisposalCouncilEvaluationProgressT }> {
  const response = await apiClient.patch<{
    success: boolean
    progress: DisposalCouncilEvaluationProgressT
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/members/${encodeURIComponent(userId)}/absence`,
    input,
  )
  return response.data
}

export async function chairDecideDisposalCouncilItem(
  councilId: string,
  itemId: string,
  input: { decision: DisposalCouncilEvaluationDecisionT; reason: string },
): Promise<{ success: boolean; progress: DisposalCouncilEvaluationProgressT }> {
  const response = await apiClient.post<{
    success: boolean
    progress: DisposalCouncilEvaluationProgressT
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/items/${encodeURIComponent(itemId)}/chair-decision`,
    input,
  )
  return response.data
}

export async function publishDisposalCouncilDecision(councilId: string): Promise<{
  councilId: string
  decisionPublishedAt: string
  documentUrl: string | null
  evaluationsLocked: boolean
}> {
  const response = await apiClient.post<{
    councilId: string
    decisionPublishedAt: string
    documentUrl: string | null
    evaluationsLocked: boolean
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/publish-decision`,
  )
  return response.data
}

export async function getDisposalCouncilDecisionDocuments(
  councilId: string,
): Promise<DisposalCouncilDecisionDocumentsT> {
  const response = await apiClient.get<DisposalCouncilDecisionDocumentsT>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/decision-documents`,
  )
  return response.data
}

export async function uploadDisposalCouncilSignedMinutes(
  councilId: string,
  file: File,
): Promise<{
  councilId: string
  documentUrl: string | null
  hasSignedMinutes: boolean
}> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post<{
    councilId: string
    documentUrl: string | null
    hasSignedMinutes: boolean
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/signed-minutes`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function finalizeDisposalCouncilReview(
  councilId: string,
  result: 'APPROVED' | 'REJECTED',
): Promise<{
  councilId: string
  result: 'APPROVED' | 'REJECTED'
  catalogStatus: string | null
}> {
  const response = await apiClient.post<{
    councilId: string
    result: 'APPROVED' | 'REJECTED'
    catalogStatus: string | null
  }>(
    `/api/v1/archive-disposal/councils/${encodeURIComponent(councilId)}/finalize`,
    { result },
  )
  return response.data
}
