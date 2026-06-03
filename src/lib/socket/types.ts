import { z } from 'zod'

const dataDossierStatusSchema = z.enum([
  'NEW',
  'OCR_PROCESSING',
  'OCR_FAILED',
  'READY_FOR_ENTRY',
  'ENTRY_PROCESSING',
  'WAITING_CHECKER_1',
  'CHECKER_1_PROCESSING',
  'CHECKER_1_REJECTED',
  'WAITING_CHECKER_2',
  'CHECKER_2_PROCESSING',
  'CHECKER_2_REJECTED',
  'WAITING_CHECKER_3',
  'CHECKER_3_PROCESSING',
  'CHECKER_3_REJECTED',
  'WAITING_CHECKER_4',
  'CHECKER_4_PROCESSING',
  'CHECKER_4_REJECTED',
  'WAITING_CHECKER_5',
  'CHECKER_5_PROCESSING',
  'CHECKER_5_REJECTED',
  'APPROVED',
])

export const ocrCompletedPayloadSchema = z.object({
  dossierId: z.string().min(1),
  folderId: z.string().min(1),
  folderPath: z.string().optional(),
  status: dataDossierStatusSchema,
  fromStatus: dataDossierStatusSchema.optional(),
  ocrMetadataKey: z.string().optional(),
  at: z.string(),
})

export type OcrCompletedPayloadT = z.infer<typeof ocrCompletedPayloadSchema>

export function parseOcrCompletedPayload(
  raw: unknown,
): OcrCompletedPayloadT | null {
  const parsed = ocrCompletedPayloadSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data
}

export type SocketRoomsT = {
  folderId: string | null
  dossierId: string | null
}

export function roomsEqual(a: SocketRoomsT, b: SocketRoomsT): boolean {
  return a.folderId === b.folderId && a.dossierId === b.dossierId
}

export type OcrCompletedHandler = (payload: OcrCompletedPayloadT) => void
