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

function isTransientSignError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('einval') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('enetunreach') ||
    lower.includes('failed query') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('socket') ||
    lower.includes('connect ') ||
    lower.includes('connection')
  )
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTransientRetry<T>(
  action: (attempt: number, isLast: boolean) => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 400
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const isLast = attempt >= retries
    try {
      return await action(attempt, isLast)
    } catch (error) {
      lastError = error
      if (isLast || !isTransientSignError(error)) {
        throw error
      }
      await sleep(baseDelayMs * (attempt + 1))
    }
  }
  throw lastError
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

      // Retry transient DB/network failures (e.g. connect EINVAL) that often
      // appear when submitting many signed files in a short window.
      await withTransientRetry((_attempt, isLast) =>
        submitDigitalSignature(
          {
            fileId: item.fileId,
            signatureBase64: signed.signatureBase64,
            certificateBase64,
            certificateSubject: params.certificate.subject,
            certificateThumbprint: params.certificate.thumbprint,
            certificateIssuer: params.certificate.issuer,
            certificateValidFrom: params.certificate.validFrom,
            certificateValidTo: params.certificate.validTo,
          },
          // Suppress toast spam on intermediate retries; last failure still toasts.
          { skipGlobalErrorToast: !isLast },
        ),
      )

      nextItems[index] = { ...nextItems[index]!, status: 'completed' }
      params.onUpdate([...nextItems])

      // Small gap between files so the backend DB pool can recover under load.
      if (index < nextItems.length - 1) {
        await sleep(150)
      }
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
