import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectManagerCandidatesQueryOptions } from '@/features/project-manager/queries'
import { cn } from '@/lib/utils/cn'

const EMPTY_MANAGER_VALUE = '__none__'

export interface ProjectManagerSelectProps {
  value?: string
  onValueChange: (managerId: string) => void
  className?: string
  enabled?: boolean
}

export function ProjectManagerSelect({
  value,
  onValueChange,
  className,
  enabled = true,
}: ProjectManagerSelectProps) {
  const { t } = useTranslation('project-manager')
  const {
    data: managers = [],
    isPending,
    isError,
  } = useQuery({
    ...projectManagerCandidatesQueryOptions(),
    enabled,
  })

  const selectValue = value?.trim() ? value : EMPTY_MANAGER_VALUE

  return (
    <Select
      value={selectValue}
      onValueChange={(nextValue) => {
        onValueChange(nextValue === EMPTY_MANAGER_VALUE ? '' : nextValue)
      }}
      disabled={isPending || isError}
    >
      <SelectTrigger
        className={cn('w-full', className)}
        aria-label={t('form.fields.managerId.label')}
      >
        <SelectValue
          placeholder={
            isPending
              ? t('form.fields.managerId.loading')
              : isError
                ? t('form.fields.managerId.loadFailed')
                : t('form.fields.managerId.placeholder')
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_MANAGER_VALUE}>
          {t('form.fields.managerId.empty')}
        </SelectItem>
        {managers.map((manager) => (
          <SelectItem key={manager.id} value={manager.id}>
            {manager.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
