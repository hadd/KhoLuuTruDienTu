import { useCallback } from 'react'

import type { ScannerResult } from '@/features/document-scan/lib/mockScanner'
import { mockScannerAdapter } from '@/features/document-scan/lib/mockScanner'

export interface ScannerAdapter {
  scan: () => Promise<ScannerResult>
  pickFiles: () => Promise<ScannerResult>
}

export function useScanner(adapter: ScannerAdapter = mockScannerAdapter) {
  const scan = useCallback(() => adapter.scan(), [adapter])
  const pickFiles = useCallback(() => adapter.pickFiles(), [adapter])

  return { scan, pickFiles }
}
