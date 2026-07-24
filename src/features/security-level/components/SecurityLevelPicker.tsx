import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'

interface SecurityLevelPickerProps {
  value?: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  label?: string
  allowClear?: boolean
}

export function SecurityLevelPicker({
  value,
  onChange,
  disabled,
  label,
  allowClear = true,
}: SecurityLevelPickerProps) {
  const { t } = useTranslation('security-level')
  const { data, isPending } = useQuery(activeSecurityLevelsQueryOptions())
  const items = [...(data?.items ?? [])].sort(
    (a, b) => a.levelOrder - b.levelOrder,
  )

  return (
    <div className="space-y-2">
      <Label>{label ?? t('picker.label')}</Label>
      <Select
        value={value || undefined}
        onValueChange={(next) =>
          onChange(next === '__none__' ? null : next)
        }
        disabled={disabled || isPending}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              isPending ? t('picker.loading') : t('picker.placeholder')
            }
          />
        </SelectTrigger>
        <SelectContent>
          {allowClear ? (
            <SelectItem value="__none__">{t('picker.none')}</SelectItem>
          ) : null}
          {items.map((level) => (
            <SelectItem key={level.id} value={level.id}>
              {level.levelOrder}. {level.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
