import type { CaAdapter, CaCertificate } from '@/lib/ca-sign/ca-types'
import {
  prepareBatchDigitalSign,
  prepareDigitalSign,
  submitDigitalSignature,
  type DigitalSignPrepareFile,
  type DigitalSignPrepareOptions,
  type VisualSignaturePayload,
} from '@/features/digital-sign/api/digitalSignClient'

export type DigitalSignQueueItemStatus =
  | 'pending'
  | 'signing'
  | 'submitting'
  | 'completed'
  | 'failed'
  | 'skipped'

export interface DigitalSignQueueItem {
  dossierId: string
  dossierName: string
  fileId: string
  fileName: string
  hashBase64: string
  status: DigitalSignQueueItemStatus
  error?: string
}

export interface DigitalSignProgress {
  items: Array<DigitalSignQueueItem>
  completed: number
  failed: number
  total: number
  isRunning: boolean
  isPaused: boolean
}

function buildQueueFromPrepare(
  dossiers: Array<{
    dossierId: string
    dossierName: string
    files: Array<DigitalSignPrepareFile>
  }>,
): Array<DigitalSignQueueItem> {
  return dossiers.flatMap((dossier) =>
    dossier.files.map((file) => ({
      dossierId: dossier.dossierId,
      dossierName: dossier.dossierName,
      fileId: file.fileId,
      fileName: file.fileName,
      hashBase64: file.hashBase64,
      status: 'pending' as const,
    })),
  )
}

export async function buildSingleDossierQueue(
  dossierId: string,
  options?: DigitalSignPrepareOptions,
): Promise<Array<DigitalSignQueueItem>> {
  const prepared = await prepareDigitalSign(dossierId, options)
  return buildQueueFromPrepare([prepared])
}

export async function buildBatchDossierQueue(
  dossierIds: Array<string>,
  options?: DigitalSignPrepareOptions,
): Promise<Array<DigitalSignQueueItem>> {
  const prepared = await prepareBatchDigitalSign(dossierIds, options)
  return buildQueueFromPrepare(prepared.dossiers)
}

export async function runDigitalSignQueue(params: {
  items: Array<DigitalSignQueueItem>
  adapter: CaAdapter
  certificate: CaCertificate
  visualSignature?: VisualSignaturePayload
  shouldStop?: () => boolean
  onUpdate: (items: Array<DigitalSignQueueItem>) => void
}): Promise<Array<DigitalSignQueueItem>> {
  const nextItems = [...params.items]
  const certificateBase64 = params.certificate.certificateBase64
  if (!certificateBase64) {
    throw new Error(
      'Thiếu certificateBase64 từ chứng thư số. Cập nhật Sohoa Sign Agent và thử lại.',
    )
  }

  for (let index = 0; index < nextItems.length; index++) {
    if (params.shouldStop?.()) {
      break
    }

    const item = nextItems[index]!
    if (item.status === 'completed' || item.status === 'skipped') {
      continue
    }

    nextItems[index] = { ...item, status: 'signing', error: undefined }
    params.onUpdate([...nextItems])

    try {
      const signed = await params.adapter.sign({
        hashBase64: item.hashBase64,
        certThumbprint: params.certificate.thumbprint,
      })

      nextItems[index] = { ...nextItems[index]!, status: 'submitting' }
      params.onUpdate([...nextItems])

      await submitDigitalSignature({
        fileId: item.fileId,
        signatureBase64: signed.signatureBase64,
        certificateBase64,
        certificateSubject: params.certificate.subject,
        certificateThumbprint: params.certificate.thumbprint,
        certificateIssuer: params.certificate.issuer,
        certificateValidFrom: params.certificate.validFrom,
        certificateValidTo: params.certificate.validTo,
      })

      nextItems[index] = { ...nextItems[index]!, status: 'completed' }
      params.onUpdate([...nextItems])
    } catch (error) {
      nextItems[index] = {
        ...nextItems[index]!,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Ký số thất bại',
      }
      params.onUpdate([...nextItems])
    }
  }

  return nextItems
}

export function summarizeQueue(items: Array<DigitalSignQueueItem>): DigitalSignProgress {
  const completed = items.filter((item) => item.status === 'completed').length
  const failed = items.filter((item) => item.status === 'failed').length
  const isRunning = items.some(
    (item) => item.status === 'signing' || item.status === 'submitting',
  )

  return {
    items,
    completed,
    failed,
    total: items.length,
    isRunning,
    isPaused: false,
  }
}
