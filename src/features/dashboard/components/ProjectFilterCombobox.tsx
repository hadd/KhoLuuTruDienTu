import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, FolderKanban, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { projectsQueryOptions } from '@/features/project-manager/queries'
import { cn } from '@/lib/utils/cn'

export const UNASSIGNED_PROJECT_CODE = '__unassigned__'

interface ProjectFilterComboboxProps {
  value?: string
  onChange: (value: string | undefined) => void
}

export function ProjectFilterCombobox({
  value,
  onChange,
}: ProjectFilterComboboxProps) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery(
    projectsQueryOptions({ limit: 200, page: 1 }),
  )

  const projects = data?.items ?? []
  const selectedProject = projects.find((p) => p.projectCode === value)

  function getDisplayLabel() {
    if (!value) return 'Tất cả dự án'
    if (value === UNASSIGNED_PROJECT_CODE) return 'Chưa gắn dự án'
    if (selectedProject) return `${selectedProject.projectCode} – ${selectedProject.projectName}`
    return value
  }

  function handleSelect(projectCode: string) {
    if (projectCode === value) {
      onChange(undefined)
    } else {
      onChange(projectCode)
    }
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(undefined)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="dashboard-project-filter"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Lọc theo dự án"
          className={cn(
            'h-9 min-w-[180px] max-w-[280px] justify-between gap-1.5 text-xs font-normal',
            value
              ? 'border-primary/50 bg-primary/5 text-foreground'
              : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{getDisplayLabel()}</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Xoá bộ lọc dự án"
                className="rounded p-0.5 hover:bg-muted"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange(undefined)
                  }
                }}
              >
                <X className="size-3 text-muted-foreground" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-3 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[320px] p-0"
        align="end"
        side="bottom"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Tìm dự án..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Đang tải...' : 'Không tìm thấy dự án.'}
            </CommandEmpty>
            <CommandGroup>
              {/* Option: all projects */}
              <CommandItem
                key="__all__"
                value="__all__ Tất cả dự án"
                onSelect={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
                className="gap-2"
              >
                <Check
                  className={cn(
                    'size-3.5',
                    !value ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="font-medium text-foreground">Tất cả dự án</span>
              </CommandItem>

              {/* Option: unassigned dossiers */}
              <CommandItem
                key="__unassigned__"
                value="__unassigned__ Chưa gắn dự án Hồ sơ chưa được gắn dự án"
                onSelect={() => handleSelect(UNASSIGNED_PROJECT_CODE)}
                className="gap-2"
              >
                <Check
                  className={cn(
                    'size-3.5',
                    value === UNASSIGNED_PROJECT_CODE ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="font-medium text-foreground">Chưa gắn dự án</span>
              </CommandItem>
            </CommandGroup>

            {projects.length > 0 ? (
              <CommandGroup heading="Danh sách dự án">
                {projects.map((project) => (
                  <CommandItem
                    key={project.projectCode}
                    value={`${project.projectCode} ${project.projectName}`}
                    onSelect={() => handleSelect(project.projectCode)}
                    className="gap-2"
                  >
                    <Check
                      className={cn(
                        'size-3.5 shrink-0',
                        value === project.projectCode
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-medium text-foreground">
                        {project.projectCode}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {project.projectName}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
