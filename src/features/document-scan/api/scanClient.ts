import type {
  ScanUploadBatchPayloadT,
  ScanUploadBatchResultT,
} from '@/features/document-scan/types'

export async function uploadScanBatch(
  payload: ScanUploadBatchPayloadT,
): Promise<ScanUploadBatchResultT> {
  await new Promise((resolve) => {
    setTimeout(resolve, 1500)
  })

  return {
    uploadedNodeIds: payload.nodeIds,
  }
}
