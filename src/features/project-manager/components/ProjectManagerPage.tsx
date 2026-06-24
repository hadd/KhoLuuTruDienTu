import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'
import { ProjectCreateDialog } from '@/features/project-manager/components/ProjectCreateDialog'
import { ProjectDeleteDialog } from '@/features/project-manager/components/ProjectDeleteDialog'
import { ProjectDetailDialog } from '@/features/project-manager/components/ProjectDetailDialog'
import { ProjectEditDialog } from '@/features/project-manager/components/ProjectEditDialog'
import { ProjectStatusBadge } from '@/features/project-manager/components/ProjectStatusBadge'
import {
  DEFAULT_PROJECTS_LIMIT,
  projectsQueryOptions,
} from '@/features/project-manager/queries'
import type { ProjectT } from '@/features/project-manager/types'

const routeApi = getRouteApi('/app/project-manager/')

function toTableRow(project: ProjectT): Row<ProjectT> {
  return { original: project } as Row<ProjectT>
}

function ClickToExpandText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const { t } = useTranslation('project-manager')
  const textRef = useRef<HTMLElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const element = textRef.current
    if (!element) return

    const checkTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth)
    }

    checkTruncation()
    const resizeObserver = new ResizeObserver(checkTruncation)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [text])

  const textBlock = (
    <TextBlock
      ref={textRef}
      as="span"
      lines={1}
      tooltip={null}
      className={cn('block', isTruncated && 'cursor-pointer', className)}
    >
      {text}
    </TextBlock>
  )

  if (!isTruncated) {
    return textBlock
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('table.showFullText')}
          className="block w-full min-w-0 text-left"
        >
          {textBlock}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-sm break-words p-3 text-sm"
      >
        {text}
      </PopoverContent>
    </Popover>
  )
}

export function ProjectManagerPage() {
  const { t } = useTranslation('project-manager')
  const search = routeApi.useSearch()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectT | null>(null)
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)

  const limit = search.limit ?? DEFAULT_PROJECTS_LIMIT
  const offset = search.offset ?? 0

  const { data, isLoading, isError } = useQuery(
    projectsQueryOptions({ limit, offset }),
  )

  const projects = data?.items ?? []

  const handleView = (project: ProjectT) => {
    setDetailProjectId(project.projectCode)
    setDetailOpen(true)
  }

  const handleEdit = (project: ProjectT) => {
    setSelectedProject(project)
    setEditOpen(true)
  }

  const handleDelete = (project: ProjectT) => {
    setSelectedProject(project)
    setDeleteOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('actions.create')}
        </Button>
      </div>

      <Card variant="list" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto [&_[data-slot=table-container]]:overflow-x-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[12%]">
                  {t('table.columns.projectCode')}
                </TableHead>
                <TableHead className="w-[22%]">
                  {t('table.columns.projectName')}
                </TableHead>
                <TableHead className="w-[18%]">
                  {t('table.columns.projectType')}
                </TableHead>
                <TableHead className="w-[22%]">
                  {t('table.columns.investor')}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t('table.columns.status')}
                </TableHead>
                <TableHead className="w-[12%] text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.projectCode}>
                    <TableCell className="max-w-0 font-medium">
                      <ClickToExpandText text={project.projectCode} />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <ClickToExpandText text={project.projectName} />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <ClickToExpandText text={project.projectType} />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <ClickToExpandText text={project.investor} />
                    </TableCell>
                    <TableCell>
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="align-top">
                      <DataTableRowActions
                        row={toTableRow(project)}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ProjectCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ProjectEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={selectedProject}
      />

      <ProjectDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        projectId={detailProjectId}
      />

      <ProjectDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        project={selectedProject}
      />
    </div>
  )
}
