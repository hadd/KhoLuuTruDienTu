import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  moveDossierPhysicalLocation,
  placeDossierPhysicalLocation,
} from '@/features/archive-submission/api/archiveSubmissionClient'
import { PhysicalLocationCascadeSelect } from '@/features/archive-submission/components/PhysicalLocationCascadeSelect'
import { translateError } from '@/lib/utils/translate-error'

interface PlacePhysicalLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName?: string
  mode: 'place' | 'move'
  onSuccess?: () => void
}

export function PlacePhysicalLocationDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  mode,
  onSuccess,
}: PlacePhysicalLocationDialogProps) {
  const { t } = useTranslation('archive-submission')
  const queryClient = useQueryClient()
  const [physicalItemId, setPhysicalItemId] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!physicalItemId) {
        throw new Error(t('physicalLocation.selectRequired'))
      }
      if (mode === 'move') {
        return moveDossierPhysicalLocation({
          dossierId,
          physicalItemId,
        })
      }
      return placeDossierPhysicalLocation({
        dossierId,
        physicalItemId,
      })
    },
    onSuccess: () => {
      toast.success(
        mode === 'move'
          ? t('physicalLocation.moveSuccess')
          : t('physicalLocation.placeSuccess'),
      )
      void queryClient.invalidateQueries({
        queryKey: ['dossier-physical-placement', dossierId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['physical-warehouse'],
      })
      setPhysicalItemId('')
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(translateError(error) || String(error.message))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPhysicalItemId('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'move'
              ? t('physicalLocation.moveTitle')
              : t('physicalLocation.placeTitle')}
          </DialogTitle>
        </DialogHeader>
        {dossierName ? (
          <p className="text-sm text-muted-foreground">{dossierName}</p>
        ) : null}
        <PhysicalLocationCascadeSelect
          value={physicalItemId}
          onValueChange={setPhysicalItemId}
          availableOnly
          disabled={mutation.isPending}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !physicalItemId}
            onClick={() => mutation.mutate()}
          >
            {mode === 'move'
              ? t('physicalLocation.move')
              : t('physicalLocation.place')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
