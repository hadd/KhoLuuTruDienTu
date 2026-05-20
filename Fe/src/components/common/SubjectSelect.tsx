import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SubjectKey } from '@/lib/constants/categories'
import { getSubjectLabel, SUBJECT_KEYS } from '@/lib/constants/categories'
import { cn } from '@/lib/utils/cn'

interface SubjectSelectProps {
  value?: SubjectKey | null
  onValueChange?: (value: SubjectKey | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
}

export function SubjectSelect({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  allowClear = false,
}: SubjectSelectProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'vi'

  const handleValueChange = (newValue: string) => {
    if (newValue === '__clear__') {
      onValueChange?.(null)
      return
    }
    if (newValue === '' || newValue === value) {
      onValueChange?.(null)
      return
    }
    onValueChange?.(newValue as SubjectKey)
  }

  return (
    <Select
      value={value ?? ''}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue
          placeholder={
            placeholder ?? (lang === 'vi' ? 'Chọn môn học' : 'Select subject')
          }
        />
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="__clear__">
            <span className="text-muted-foreground">
              {lang === 'vi' ? 'Không chọn' : 'No selection'}
            </span>
          </SelectItem>
        )}
        {SUBJECT_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {getSubjectLabel(key, lang)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
