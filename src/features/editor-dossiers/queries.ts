import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getEditorDraftDossiers,
  submitEditorDraftFinalSave,
  submitEditorDraftFinalSaveItems,
} from '@/features/editor-dossiers/api/editorDossierClient'
import type { EditorDraftSubmitItemT } from '@/features/editor-dossiers/types'

export const editorDraftDossiersQueryKey = [
  'editor-dossiers',
  'drafts',
] as const

export const editorDraftDossiersQueryOptions = () =>
  queryOptions({
    queryKey: editorDraftDossiersQueryKey,
    queryFn: getEditorDraftDossiers,
    staleTime: 30_000,
  })

export function useSubmitEditorDraftFinalSaveMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dossierIds: Array<string>) =>
      submitEditorDraftFinalSave(dossierIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: editorDraftDossiersQueryKey,
      })
    },
  })
}

export function useSubmitEditorDraftFinalSaveItemsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: Array<EditorDraftSubmitItemT>) =>
      submitEditorDraftFinalSaveItems(items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: editorDraftDossiersQueryKey,
      })
    },
  })
}
