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

function ExpandableTextCell({
  text,
  breakAll = false,
  className,
}: {
  text: string
  breakAll?: boolean
  className?: string
}) {
  const { t } = useTranslation('project-manager')
  const textRef = useRef<HTMLElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [text])

  useEffect(() => {
    if (expanded) return

    const element = textRef.current
    if (!element) return

    const checkTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth)
    }

    checkTruncation()
    const resizeObserver = new ResizeObserver(checkTruncation)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [text, expanded])

  const canToggle = isTruncated || expanded

  const handleToggle = () => {
    if (canToggle) setExpanded((prev) => !prev)
  }

  const wrapClassName = breakAll
    ? 'whitespace-normal break-all [overflow-wrap:anywhere]'
    : 'whitespace-normal break-words [overflow-wrap:anywhere]'

  return (
    <TableCell
      className={cn(
        'align-top !whitespace-normal',
        expanded ? wrapClassName : 'max-w-0 overflow-hidden',
        className,
      )}
    >
      <div
        role={canToggle ? 'button' : undefined}
        tabIndex={canToggle ? 0 : undefined}
        onClick={handleToggle}
        onKeyDown={
          canToggle
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleToggle()
                }
              }
            : undefined
        }
        aria-expanded={canToggle ? expanded : undefined}
        aria-label={
          canToggle
            ? expanded
              ? t('table.collapseText')
              : t('table.showFullText')
            : undefined
        }
        className={cn('w-full min-w-0', canToggle && 'cursor-pointer', expanded && wrapClassName)}
      >
        {expanded ? (
          text
        ) : (
          <TextBlock
            ref={textRef}
            as="span"
            lines={1}
            tooltip={null}
            className="block w-full min-w-0"
          >
            {text}
          </TextBlock>
        )}
      </div>
    </TableCell>
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
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editFallbackProject, setEditFallbackProject] = useState<ProjectT | null>(null)
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
    setEditProjectId(project.projectCode)
    setEditFallbackProject(project)
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
        <div className="flex-1 overflow-y-auto">
          <Table className="w-full min-w-[720px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[14%]">
                  {t('table.columns.projectCode')}
                </TableHead>
                <TableHead className="w-[24%]">
                  {t('table.columns.projectName')}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t('table.columns.projectType')}
                </TableHead>
                <TableHead className="w-[18%]">
                  {t('table.columns.investor')}
                </TableHead>
                <TableHead className="w-36">
                  {t('table.columns.status')}
                </TableHead>
                <TableHead className="w-28 text-right">
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
                    <ExpandableTextCell
                      text={project.projectCode}
                      breakAll
                      className="w-[14%] font-medium"
                    />
                    <ExpandableTextCell
                      text={project.projectName}
                      breakAll
                      className="w-[24%]"
                    />
                    <ExpandableTextCell
                      text={project.projectType}
                      className="w-[14%]"
                    />
                    <ExpandableTextCell
                      text={project.investor}
                      className="w-[18%]"
                    />
                    <TableCell className="w-36 align-top">
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="w-28 align-top">
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
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen)
          if (!nextOpen) {
            setEditProjectId(null)
            setEditFallbackProject(null)
          }
        }}
        projectId={editProjectId}
        fallbackProject={editFallbackProject}
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
