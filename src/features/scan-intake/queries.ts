import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { checkScanAgentHealth } from '@/features/scan-intake/api/scanAgentClient'
import {
  assemblePdf,
  attachPreviewUrls,
  createPageUploadPoint,
  deletePageObject,
  deletePagesBulk,
  deleteDocumentDraft,
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
      existingKeys: string[]
      duplex?: boolean
    }) => {
      const duplex = input.duplex ?? false

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
        duplex: true, // Always force hardware duplex to fix scanner quality quirks
        adf: true,
        colorMode: 'color',
        uploadUrls: uploadPoints.map((p) => p.uploadUrl),
      })
      if ('cancelled' in result) return { cancelled: true as const }
      
      if ('uploaded' in result) {
        let keys = uploadPoints.slice(0, result.pageCount).map((p) => p.key)
        
        if (!duplex) {
          // Drop back sides (even indices)
          const oddKeys = keys.filter((_, i) => i % 2 === 0)
          const evenKeys = keys.filter((_, i) => i % 2 !== 0)
          if (evenKeys.length > 0) {
            await deletePagesBulk(evenKeys).catch(console.error)
          }
          keys = oddKeys
          
          // Reorder to remove filename gaps
          const allKeys = [...input.existingKeys, ...keys]
          if (allKeys.length > 0) {
            await reorderPages({
              sessionId: sessionId!,
              docSlug: input.docSlug,
              pageKeys: allKeys,
            }).catch(console.error)
          }
        }
        
        return { pageCount: keys.length, keys }
      }
      throw new Error('Batch scan expected JSON upload response from agent')
    },
    onSuccess: invalidateSession,
  })

  const rotatePageMutation = useMutation({
    mutationFn: async (input: {
      docSlug: string
      pageKey: string
      previewUrl: string
      degrees: number
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

  const deletePagesMutation = useMutation({
    mutationFn: (pageKeys: Array<string>) => deletePagesBulk(pageKeys),
    onSuccess: invalidateSession,
  })

  const deleteDocumentMutation = useMutation({
    mutationFn: (docSlug: string) => deleteDocumentDraft({ sessionId: sessionId!, docSlug }),
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
      projectCode?: string | null
      targetFolderPath: string
      organizeFolderPath?: string
      pdfKeys: Array<string>
      folderPaths?: Array<string>
    }) =>
      promoteSession({
        projectCode: input.projectCode ?? null,
        sessionId: sessionId!,
        targetFolderPath: input.targetFolderPath,
        organizeFolderPath: input.organizeFolderPath,
        pdfKeys: input.pdfKeys,
        folderPaths: input.folderPaths,
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
    deletePagesMutation,
    deleteDocumentMutation,
    assemblePdfMutation,
    organizeMoveMutation,
    organizeRenameFolderMutation,
    organizeRenamePdfMutation,
    promoteMutation,
    invalidateSession,
    presignedGet,
  }
}
