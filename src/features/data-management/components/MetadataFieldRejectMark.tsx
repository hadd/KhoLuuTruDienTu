import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'

export function MetadataFieldRejectMark({
  id,
  fieldLabel,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: {
  id: string
  fieldLabel: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation('data-management')

  return (
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
      aria-label={t('metadata.rejectInline.markIncorrect', {
        field: fieldLabel,
      })}
      className={cn(
        'mt-2 shrink-0 data-[state=checked]:border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground',
        className,
      )}
    />
  )
}
