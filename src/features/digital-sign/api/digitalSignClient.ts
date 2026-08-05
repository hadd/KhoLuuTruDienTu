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

export interface VisualSignaturePayload {
  pageNumber?: number
  xRatio?: number
  yRatio?: number
  /** Legacy fixed-size box in PDF points. */
  widthPx?: number
  heightPx?: number
  /** Preferred: box size as % of page width/height — lets the user resize
   * the signature box by dragging its corner (content auto-fits to it). */
  widthRatio?: number
  heightRatio?: number
  reason?: string
  location?: string
  appearanceType?: string
  stampImageBase64?: string
}

export interface DigitalSignPrepareOptions {
  certificateSubject?: string
  certificateIssuer?: string
  /** Full certificate DER (base64) so the drawn appearance can show the
   * complete DN (C/O/L/CN/UID/E) exactly as encoded in the certificate. */
  certificateBase64?: string
  visualSignature?: VisualSignaturePayload
  /** Per-file prepare with individual visual placements */
  files?: Array<{
    fileId: string
    visualSignature?: VisualSignaturePayload
  }>
  fileIds?: Array<string>
}

export interface DigitalSignSubmitPayload {
  fileId: string
  signatureBase64: string
  certificateBase64: string
  certificateSubject: string
  certificateThumbprint: string
  certificateIssuer: string
  certificateValidFrom?: string
  certificateValidTo?: string
  visualSignature?: VisualSignaturePayload
}

export interface DigitalSignFileStatus {
  id: string
  fileName: string
  filePath: string
  fileUrl?: string
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
  options?: DigitalSignPrepareOptions,
): Promise<DigitalSignPrepareResponse> {
  const response = await apiClient.post<DigitalSignPrepareResponse>(
    '/api/v1/digital-sign/prepare',
    {
      dossierId,
      certificateSubject: options?.certificateSubject,
      certificateIssuer: options?.certificateIssuer,
      certificateBase64: options?.certificateBase64,
      visualSignature: options?.visualSignature,
      files: options?.files,
      fileIds: options?.fileIds,
    },
  )
  return response.data
}

export async function prepareBatchDigitalSign(
  dossierIds: Array<string>,
  options?: DigitalSignPrepareOptions,
): Promise<DigitalSignBatchPrepareResponse> {
  const response = await apiClient.post<DigitalSignBatchPrepareResponse>(
    '/api/v1/digital-sign/batch/prepare',
    {
      dossierIds,
      certificateSubject: options?.certificateSubject,
      certificateIssuer: options?.certificateIssuer,
      certificateBase64: options?.certificateBase64,
      visualSignature: options?.visualSignature,
      files: options?.files,
      fileIds: options?.fileIds,
    },
  )
  return response.data
}

export async function submitDigitalSignature(
  payload: DigitalSignSubmitPayload,
  options?: { skipGlobalErrorToast?: boolean },
): Promise<{ fileId: string; dossierId: string; signedFilePath: string }> {
  const response = await apiClient.post<{
    fileId: string
    dossierId: string
    signedFilePath: string
  }>('/api/v1/digital-sign/submit', payload, {
    _skipGlobalErrorToast: options?.skipGlobalErrorToast,
  })
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
