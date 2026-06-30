import { apiClient } from '@/lib/api/apiClient'

export interface DigitalSignPrepareFile {
  fileId: string
  fileName: string
  filePath: string
  hashBase64: string
}

export interface DigitalSignPrepareResponse {
  dossierId: string
  dossierName: string
  files: Array<DigitalSignPrepareFile>
  totalFiles: number
}

export interface DigitalSignBatchPrepareResponse {
  dossiers: Array<DigitalSignPrepareResponse>
  totalDossiers: number
  totalFiles: number
}

export interface DigitalSignSubmitPayload {
  fileId: string
  signatureBase64: string
  certificateSubject: string
  certificateThumbprint: string
  certificateIssuer: string
  certificateValidFrom?: string
  certificateValidTo?: string
}

export interface DigitalSignFileStatus {
  id: string
  fileName: string
  filePath: string
  signedFilePath: string | null
  signedAt: string | null
  isSigned: boolean
  signature: {
    id: string
    fileId: string
    certificateSubject: string
    certificateThumbprint: string
    certificateIssuer: string
    certificateValidFrom: string | null
    certificateValidTo: string | null
    signedAt: string
    signedBy: string | null
    signerName: string | null
  } | null
}

export interface DigitalSignStatusResponse {
  dossierId: string
  dossierName: string
  totalFiles: number
  signedFiles: number
  pendingFiles: number
  isFullySigned: boolean
  files: Array<DigitalSignFileStatus>
}

export interface DigitalSignHistoryItem {
  id: string
  fileId: string
  certificateSubject: string
  certificateThumbprint: string
  certificateIssuer: string
  certificateValidFrom: string | null
  certificateValidTo: string | null
  signedAt: string
  signedBy: string | null
  signerName: string | null
}

export interface DigitalSignVerifyResponse {
  fileId: string
  dossierId: string
  signedFilePath: string
  valid: boolean
  reason?: string
  certificateSubject?: string
  certificateIssuer?: string
}

export async function prepareDigitalSign(
  dossierId: string,
): Promise<DigitalSignPrepareResponse> {
  const response = await apiClient.post<DigitalSignPrepareResponse>(
    '/api/v1/digital-sign/prepare',
    { dossierId },
  )
  return response.data
}

export async function prepareBatchDigitalSign(
  dossierIds: Array<string>,
): Promise<DigitalSignBatchPrepareResponse> {
  const response = await apiClient.post<DigitalSignBatchPrepareResponse>(
    '/api/v1/digital-sign/batch/prepare',
    { dossierIds },
  )
  return response.data
}

export async function submitDigitalSignature(
  payload: DigitalSignSubmitPayload,
): Promise<{ fileId: string; dossierId: string; signedFilePath: string }> {
  const response = await apiClient.post<{
    fileId: string
    dossierId: string
    signedFilePath: string
  }>('/api/v1/digital-sign/submit', payload)
  return response.data
}

export async function getDigitalSignStatus(
  dossierId: string,
): Promise<DigitalSignStatusResponse> {
  const response = await apiClient.get<DigitalSignStatusResponse>(
    `/api/v1/digital-sign/status/${dossierId}`,
  )
  return response.data
}

export async function getDigitalSignHistory(
  dossierId: string,
): Promise<Array<DigitalSignHistoryItem>> {
  const response = await apiClient.get<Array<DigitalSignHistoryItem>>(
    `/api/v1/digital-sign/history/${dossierId}`,
  )
  return response.data
}

export async function verifyDigitalSignature(
  fileId: string,
): Promise<DigitalSignVerifyResponse> {
  const response = await apiClient.post<DigitalSignVerifyResponse>(
    `/api/v1/digital-sign/verify/${fileId}`,
  )
  return response.data
}
