import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { dataManagementProjectsQueryOptions } from '@/features/data-management/queries'

export interface ProjectSelectProps {
  value?: string
  onValueChange: (projectCode: string) => void
  className?: string
  enabled?: boolean
}

export function ProjectSelect({
  value,
  onValueChange,
  className,
  enabled = true,
}: ProjectSelectProps) {
  const { t } = useTranslation('data-management')
  const { data, isPending, isError } = useQuery({
    ...dataManagementProjectsQueryOptions(),
    enabled,
  })

  const projects = data?.items ?? []

  return (
    <Select
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={isPending || isError || projects.length === 0}
    >
      <SelectTrigger className={className} aria-label={t('project.label')}>
        <SelectValue
          placeholder={
            isPending
              ? t('project.loading')
              : isError
                ? t('project.loadFailed')
                : t('project.placeholder')
          }
        />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.projectCode} value={project.projectCode}>
            {project.projectName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
