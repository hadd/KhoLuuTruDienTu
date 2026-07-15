import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getDossierPhysicalPlacement,
  removeDossierPhysicalLocation,
} from '@/features/archive-submission/api/archiveSubmissionClient'
import { PlacePhysicalLocationDialog } from '@/features/archive-submission/components/PlacePhysicalLocationDialog'
import { translateError } from '@/lib/utils/translate-error'

interface DossierPhysicalLocationSectionProps {
  dossierId: string
  dossierName?: string
  canManage?: boolean
}

export function DossierPhysicalLocationSection({
  dossierId,
  dossierName,
  canManage = false,
}: DossierPhysicalLocationSectionProps) {
  const { t } = useTranslation('archive-submission')
  const queryClient = useQueryClient()
  const [dialogMode, setDialogMode] = useState<'place' | 'move' | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['dossier-physical-placement', dossierId],
    queryFn: () => getDossierPhysicalPlacement(dossierId),
    enabled: Boolean(dossierId),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeDossierPhysicalLocation({ dossierId }),
    onSuccess: () => {
      toast.success(t('physicalLocation.removeSuccess'))
      void queryClient.invalidateQueries({
        queryKey: ['dossier-physical-placement', dossierId],
      })
      void queryClient.invalidateQueries({ queryKey: ['physical-warehouse'] })
      void queryClient.invalidateQueries({ queryKey: ['archive-warehouse'] })
    },
    onError: (error) => {
      toast.error(translateError(error) || String(error.message))
    },
  })

  const placed = Boolean(data?.placement)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {t('physicalLocation.current')}
        </h3>
        {!isPending && !placed ? (
          <Badge variant="secondary">{t('physicalLocation.unplaced')}</Badge>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">{t('form.loading')}</p>
      ) : (
        <p className="text-sm text-foreground">
          {placed ? (data?.breadcrumb ?? '—') : t('physicalLocation.unplaced')}
        </p>
      )}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {placed ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDialogMode('move')}
              >
                {t('physicalLocation.move')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}
              >
                {t('physicalLocation.remove')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogMode('place')}
            >
              {t('physicalLocation.place')}
            </Button>
          )}
        </div>
      ) : null}

      {dialogMode ? (
        <PlacePhysicalLocationDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogMode(null)
          }}
          dossierId={dossierId}
          dossierName={dossierName}
          mode={dialogMode}
          onSuccess={() => {
            void queryClient.invalidateQueries({
              queryKey: ['archive-warehouse'],
            })
          }}
        />
      ) : null}
    </section>
  )
}
