import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'
import { dataManagementProjectsQueryOptions } from '@/features/data-management/queries'
import type { ProjectT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

export interface ProjectSelectProps {
  value?: string
  onValueChange: (projectCode: string) => void
  className?: string
  enabled?: boolean
  /** When false, hides the "all / no project" sentinel option. Default true. */
  showAllOption?: boolean
  /** Custom label for the sentinel option (defaults to project.all). */
  allOptionLabel?: string
}

function matchesProjectSearch(project: ProjectT, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    project.projectName.toLowerCase().includes(normalized) ||
    project.projectCode.toLowerCase().includes(normalized)
  )
}

export function ProjectSelect({
  value,
  onValueChange,
  className,
  enabled = true,
  showAllOption: showAllOptionProp = true,
  allOptionLabel,
}: ProjectSelectProps) {
  const { t } = useTranslation('data-management')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isPending, isError } = useQuery({
    ...dataManagementProjectsQueryOptions(),
    enabled,
  })

  const projects = data?.items ?? []
  const isAllSelected = value?.trim() === ALL_PROJECTS_CODE
  const selectedProject = projects.find(
    (project) => project.projectCode === value?.trim(),
  )
  const isInteractionDisabled = isPending || isError
  const isSearchEmpty = !searchQuery.trim()
  const showAllOptionRow = showAllOptionProp && isSearchEmpty
  const allLabel = allOptionLabel ?? t('project.all')

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => matchesProjectSearch(project, searchQuery)),
    [projects, searchQuery],
  )

  const triggerPlaceholder = isPending
    ? t('project.loading')
    : isError
      ? t('project.loadFailed')
      : t('project.placeholder')

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setSearchQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('project.label')}
          className={cn(
            'w-full min-w-0 justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2 overflow-hidden',
            className,
          )}
          disabled={isInteractionDisabled}
        >
          {isPending ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {triggerPlaceholder}
            </span>
          ) : isAllSelected ? (
            <span className="block min-w-0 max-w-full flex-1 truncate text-foreground">
              {allLabel}
            </span>
          ) : selectedProject ? (
            <span className="block min-w-0 max-w-full flex-1 truncate text-foreground">
              {selectedProject.projectName}
            </span>
          ) : (
            <span className="block min-w-0 max-w-full flex-1 truncate text-muted-foreground">
              {triggerPlaceholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={(event) => event.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('project.searchPlaceholder')}
              className="pl-8"
              disabled={isInteractionDisabled}
            />
          </div>
        </div>

        <div
          className="max-h-60 overflow-y-auto overscroll-contain p-1 space-y-1"
          onWheel={(event) => event.stopPropagation()}
        >
          {isPending ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t('project.loading')}
            </p>
          ) : !showAllOptionRow && filteredProjects.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {projects.length === 0
                ? t('project.empty')
                : t('project.noResults')}
            </p>
          ) : (
            <>
              {showAllOptionRow ? (
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted',
                    isAllSelected && 'bg-muted/60',
                  )}
                  onClick={() => {
                    onValueChange(ALL_PROJECTS_CODE)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                >
                  <span className="truncate font-medium text-foreground">
                    {allLabel}
                  </span>
                  <div
                    className={cn(
                      'ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary transition-all',
                      isAllSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50',
                    )}
                  >
                    {isAllSelected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              ) : null}
              {filteredProjects.map((project) => {
                const isSelected = value?.trim() === project.projectCode
                return (
                  <button
                    key={project.projectCode}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted',
                      isSelected && 'bg-muted/60',
                    )}
                    onClick={() => {
                      onValueChange(project.projectCode)
                      setOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {project.projectName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {project.projectCode}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary transition-all',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50',
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
