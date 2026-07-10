import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArchiveDynamicForm } from '@/features/archive-submission/components/ArchiveDynamicForm'
import {
  activeArchiveFieldConfigsQueryOptions,
  useSubmitArchiveMutation,
} from '@/features/archive-submission/queries'
import type { ArchiveFieldValueSnapshotT } from '@/features/archive-submission/types'
import { translateError } from '@/lib/utils/translate-error'

interface ArchiveSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string | null
  dossierName?: string
  onSuccess?: () => void
}

function validateRequiredFields(
  fields: Array<{ fieldKey: string; label: string; isRequired: boolean }>,
  values: ArchiveFieldValueSnapshotT,
): string | null {
  for (const field of fields) {
    if (!field.isRequired) continue
    const value = values[field.fieldKey]
    if (value === null || value === undefined) return field.label
    if (typeof value === 'string' && value.trim() === '') return field.label
  }
  return null
}

export function ArchiveSubmitDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  onSuccess,
}: ArchiveSubmitDialogProps) {
  const { t } = useTranslation('archive-submission')
  const [fieldValues, setFieldValues] = useState<ArchiveFieldValueSnapshotT>({})
  const submitMutation = useSubmitArchiveMutation()

  const { data: fields = [], isPending, isError } = useQuery({
    ...activeArchiveFieldConfigsQueryOptions(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setFieldValues({})
    }
  }, [open])

  async function handleSubmit() {
    if (!dossierId) return

    const missingLabel = validateRequiredFields(fields, fieldValues)
    if (missingLabel) {
      toast.error(t('form.requiredField', { field: missingLabel }))
      return
    }

    try {
      await submitMutation.mutateAsync({
        dossierId,
        payload: { fieldValues },
      })
      toast.success(t('submit.success'))
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(translateError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('submit.title')}</DialogTitle>
          <DialogDescription>
            {dossierName
              ? t('submit.descriptionWithName', { name: dossierName })
              : t('submit.description')}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('form.loading')}</p>
        ) : null}

        {isError ? (
          <p className="text-sm text-destructive">{t('form.loadFailed')}</p>
        ) : null}

        {!isPending && !isError && fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('submit.noFields')}</p>
        ) : null}

        {!isPending && !isError && fields.length > 0 ? (
          <ArchiveDynamicForm
            fields={fields}
            value={fieldValues}
            onChange={setFieldValues}
            disabled={submitMutation.isPending}
          />
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              !dossierId ||
              submitMutation.isPending ||
              isPending ||
              isError ||
              fields.length === 0
            }
          >
            {t('submit.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
