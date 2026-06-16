import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useRejectCheckerDossierMutation } from '@/features/data-management/queries'

export function useQcInlineReject({
  dossierId,
  onSuccess,
}: {
  dossierId: string
  onSuccess: () => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const [rejectFieldKeys, setRejectFieldKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [rejectNotes, setRejectNotes] = useState('')
  const rejectMutation = useRejectCheckerDossierMutation('qc')

  const isRejectMode = rejectFieldKeys.size > 0

  function toggleRejectField(fieldKey: string, checked: boolean) {
    setRejectFieldKeys((previous) => {
      const next = new Set(previous)
      if (checked) next.add(fieldKey)
      else next.delete(fieldKey)
      return next
    })
  }

  function clearRejectSelection() {
    setRejectFieldKeys(new Set())
    setRejectNotes('')
  }

  const resetRejectState = useCallback(() => {
    clearRejectSelection()
  }, [])

  async function submitReject() {
    if (rejectFieldKeys.size === 0 || rejectMutation.isPending) return

    try {
      await rejectMutation.mutateAsync({
        dossierId,
        notes: rejectNotes.trim(),
        rejectFields: Array.from(rejectFieldKeys),
      })
      toast.success(t('metadata.rejectSuccess'))
      clearRejectSelection()
      await onSuccess()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('metadata.rejectError')
      toast.error(message)
    }
  }

  return {
    rejectFieldKeys,
    rejectNotes,
    setRejectNotes,
    isRejectMode,
    toggleRejectField,
    clearRejectSelection,
    resetRejectState,
    submitReject,
    isRejectPending: rejectMutation.isPending,
  }
}
