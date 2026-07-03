import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { checkScanAgentHealth } from '@/features/scan-intake/api/scanAgentClient'
import {
  assemblePdf,
  attachPreviewUrls,
  createPageUploadPoint,
  deletePageObject,
  deleteScanSession,
  getScanSession,
  organizeMove,
  organizeRenameFolder,
  organizeRenamePdf,
  presignedGet,
  promoteSession,
  reorderPages,
  scanToMinio,
  uploadBlobToPresignedUrl,
} from '@/features/scan-intake/api/scanIntakeClient'
import {
  SCAN_BATCH_MAX_PAGES,
} from '@/features/scan-intake/lib/constants'
import {
  rotateImageBlob,
  nextPageFileName,
} from '@/features/scan-intake/lib/imageEdit'

export const scanIntakeKeys = {
  all: ['scan-intake'] as const,
  health: () => [...scanIntakeKeys.all, 'agent-health'] as const,
  session: (sessionId: string) =>
    [...scanIntakeKeys.all, 'session', sessionId] as const,
}

export function scanAgentHealthQueryOptions() {
  return queryOptions({
    queryKey: scanIntakeKeys.health(),
    queryFn: checkScanAgentHealth,
    retry: false,
    refetchInterval: (query) => (query.state.data ? 120_000 : 15_000),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function scanSessionQueryOptions(sessionId: string | undefined) {
  return queryOptions({
    queryKey: scanIntakeKeys.session(sessionId ?? ''),
    queryFn: async () => {
      const session = await getScanSession(sessionId!)
      return attachPreviewUrls(session)
    },
    enabled: Boolean(sessionId),
    staleTime: 0,
  })
}

export function useScanAgentHealth() {
  return useQuery(scanAgentHealthQueryOptions())
}

export function useScanSession(sessionId: string | undefined) {
  return useQuery(scanSessionQueryOptions(sessionId))
}

export function useScanIntakeMutations(sessionId: string | undefined) {
  const queryClient = useQueryClient()

  function invalidateSession() {
    if (sessionId) {
      void queryClient.invalidateQueries({
        queryKey: scanIntakeKeys.session(sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: [...scanIntakeKeys.all, 'preview'],
      })
      void queryClient.invalidateQueries({
        queryKey: [...scanIntakeKeys.all, 'pdf-preview'],
      })
    }
  }

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteScanSession(sessionId!),
    onSuccess: invalidateSession,
  })

  const scanPageMutation = useMutation({
    mutationFn: async (input: {
      docSlug: string
      pageCount: number
      duplex?: boolean
    }) => {
      const duplex = input.duplex ?? false

      if (duplex) {
        const uploadPoints = await Promise.all(
          Array.from({ length: SCAN_BATCH_MAX_PAGES }, (_, i) =>
            createPageUploadPoint({
              sessionId: sessionId!,
              docSlug: input.docSlug,
              fileName: nextPageFileName(input.pageCount + i),
            }),
          ),
        )
        const result = await scanToMinio({
          duplex: true,
          adf: true,
          uploadUrls: uploadPoints.map((p) => p.uploadUrl),
        })
        if ('cancelled' in result) return { cancelled: true as const }
        if ('uploaded' in result) {
          return { pageCount: result.pageCount, keys: uploadPoints.slice(0, result.pageCount).map((p) => p.key) }
        }
        throw new Error('Duplex scan expected JSON upload response from agent')
      }

      const fileName = nextPageFileName(input.pageCount)
      const uploadPoint = await createPageUploadPoint({
        sessionId: sessionId!,
        docSlug: input.docSlug,
        fileName,
      })
      const result = await scanToMinio({ uploadUrl: uploadPoint.uploadUrl })
      if ('cancelled' in result) return { cancelled: true as const }
      if ('uploaded' in result) return { key: uploadPoint.key, fileName }
      await uploadBlobToPresignedUrl(
        uploadPoint.uploadUrl,
        result,
        'image/jpeg',
      )
      return { key: uploadPoint.key, fileName }
    },
    onSuccess: invalidateSession,
  })

  const rotatePageMutation = useMutation({
    mutationFn: async (input: {
      docSlug: string
      pageKey: string
      previewUrl: string
      degrees: 90 | 180 | 270
    }) => {
      const blob = await rotateImageBlob(input.previewUrl, input.degrees)
      const fileName = input.pageKey.split('/').pop()!
      const uploadPoint = await createPageUploadPoint({
        sessionId: sessionId!,
        docSlug: input.docSlug,
        fileName,
      })
      await uploadBlobToPresignedUrl(
        uploadPoint.uploadUrl,
        blob,
        'image/jpeg',
      )
    },
    onSuccess: invalidateSession,
  })

  const reorderPageMutation = useMutation({
    mutationFn: (input: { docSlug: string; pageKeys: Array<string> }) =>
      reorderPages({
        sessionId: sessionId!,
        docSlug: input.docSlug,
        pageKeys: input.pageKeys,
      }),
    onSuccess: invalidateSession,
  })

  const deletePageMutation = useMutation({
    mutationFn: (pageKey: string) => deletePageObject(pageKey),
    onSuccess: invalidateSession,
  })

  const assemblePdfMutation = useMutation({
    mutationFn: (input: { docSlug: string; displayName: string }) =>
      assemblePdf({
        sessionId: sessionId!,
        docSlug: input.docSlug,
        displayName: input.displayName,
      }),
    onSuccess: invalidateSession,
  })

  const organizeMoveMutation = useMutation({
    mutationFn: (input: { sourceKey: string; destKey: string }) =>
      organizeMove({
        sessionId: sessionId!,
        ...input,
      }),
    onSuccess: invalidateSession,
  })

  const organizeRenameFolderMutation = useMutation({
    mutationFn: (input: { folderPath: string; newName: string }) =>
      organizeRenameFolder({
        sessionId: sessionId!,
        ...input,
      }),
    onSuccess: invalidateSession,
  })

  const organizeRenamePdfMutation = useMutation({
    mutationFn: (input: { pdfKey: string; newName: string }) =>
      organizeRenamePdf({
        sessionId: sessionId!,
        ...input,
      }),
    onSuccess: invalidateSession,
  })

  const promoteMutation = useMutation({
    mutationFn: (input: {
      projectCode: string
      targetFolderPath: string
      organizeFolderPath?: string
      pdfKeys: Array<string>
    }) =>
      promoteSession({
        projectCode: input.projectCode,
        sessionId: sessionId!,
        targetFolderPath: input.targetFolderPath,
        organizeFolderPath: input.organizeFolderPath,
        pdfKeys: input.pdfKeys,
        cleanup: false,
      }),
    onSuccess: invalidateSession,
  })

  return {
    deleteSessionMutation,
    scanPageMutation,
    rotatePageMutation,
    reorderPageMutation,
    deletePageMutation,
    assemblePdfMutation,
    organizeMoveMutation,
    organizeRenameFolderMutation,
    organizeRenamePdfMutation,
    promoteMutation,
    invalidateSession,
    presignedGet,
  }
}
