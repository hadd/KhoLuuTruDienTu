import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { MAX_APPROVAL_LEVELS } from '@/features/group/lib/groupPayload'
import { cn } from '@/lib/utils/cn'

interface ApprovalRoundStepperProps {
  value: number
  isEditing?: boolean
  disabled?: boolean
  onChange?: (value: number) => void
  className?: string
}

export function ApprovalRoundStepper({
  value,
  isEditing = false,
  disabled = false,
  onChange,
  className,
}: ApprovalRoundStepperProps) {
  const { t } = useTranslation('group')

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {t('createDialog.fields.roundNumber.label')}
      </span>

      {isEditing ? (
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none bg-muted hover:bg-accent"
            disabled={disabled || value <= 0}
            onClick={() => onChange?.(value - 1)}
            aria-label={t('card.actions.decreaseRoundNumber')}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="flex h-8 min-w-10 items-center justify-center border-x border-border bg-card px-3 text-sm font-semibold text-foreground">
            {value}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none bg-muted hover:bg-accent"
            disabled={disabled || value >= MAX_APPROVAL_LEVELS}
            onClick={() => onChange?.(value + 1)}
            aria-label={t('card.actions.increaseRoundNumber')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <span className="flex h-8 min-w-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground">
          {value}
        </span>
      )}
    </div>
  )
}
