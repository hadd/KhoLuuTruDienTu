import { Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function QcInlineRejectBar({
  selectedCount,
  notes,
  onNotesChange,
  onClear,
  onSubmit,
  isPending,
}: {
  selectedCount: number
  notes: string
  onNotesChange: (value: string) => void
  onClear: () => void
  onSubmit: () => void | Promise<void>
  isPending: boolean
}) {
  const { t } = useTranslation('data-management')

  return (
    <div className="grid shrink-0 gap-3 border-t border-border pt-3">
      <div className="grid gap-2">
        <Label htmlFor="qc-reject-notes">
          {t('metadata.rejectInline.notesLabel')}
        </Label>
        <Textarea
          id="qc-reject-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={t('metadata.rejectInline.notesPlaceholder')}
          disabled={isPending}
          rows={2}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {t('metadata.rejectInline.selectedCount', {
              count: selectedCount,
            })}
          </span>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-muted-foreground"
            onClick={onClear}
            disabled={isPending}
          >
            {t('metadata.rejectInline.clear')}
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          onClick={() => void onSubmit()}
          disabled={isPending || selectedCount === 0}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <XCircle className="size-4" aria-hidden />
          )}
          {isPending
            ? t('metadata.rejecting')
            : t('metadata.rejectInline.confirm')}
        </Button>
      </div>
    </div>
  )
}
