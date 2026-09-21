import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useRejectCheckerDossierMutation } from '@/features/data-management/queries'
import { translateError } from '@/lib/utils/translate-error'

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
  const [isHandlingReject, setIsHandlingReject] = useState(false)
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
    if (isHandlingReject) return
    setIsHandlingReject(true)

    try {
      const notes =
        rejectNotes.trim() ||
        t('metadata.rejectInline.defaultNote', 'QC từ chối')
      await rejectMutation.mutateAsync({
        dossierId,
        notes,
        rejectFields: Array.from(rejectFieldKeys),
      })
      toast.success(t('metadata.rejectSuccess'))
      clearRejectSelection()
      await onSuccess()
    } catch (error) {
      toast.error(translateError(error) || t('metadata.rejectError'))
    } finally {
      setIsHandlingReject(false)
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
    isRejectPending: isHandlingReject || rejectMutation.isPending,
  }
}
