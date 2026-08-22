import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectSectionTabs } from '@/features/project-management/components/ProjectSectionTabs'
import { ProjectCreateDialog } from '@/features/project-manager/components/ProjectCreateDialog'
import { ProjectDeleteDialog } from '@/features/project-manager/components/ProjectDeleteDialog'
import { ProjectDetailDialog } from '@/features/project-manager/components/ProjectDetailDialog'
import { ProjectEditDialog } from '@/features/project-manager/components/ProjectEditDialog'
import { ProjectStatusBadge } from '@/features/project-manager/components/ProjectStatusBadge'
import { useProjectAccess } from '@/features/project-manager/hooks/useProjectAccess'
import {
  DEFAULT_PROJECTS_LIMIT,
  projectsQueryOptions,
} from '@/features/project-manager/queries'
import { formatProjectManagerName } from '@/features/project-manager/lib/normalizeProject'
import type { ProjectT } from '@/features/project-manager/types'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { cn } from '@/lib/utils/cn'

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
        className={cn(
          'w-full min-w-0',
          canToggle && 'cursor-pointer',
          expanded && wrapClassName,
        )}
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
  const {
    canCreateProjects,
    canUpdateProjects,
    canDeleteProjects,
  } = useProjectAccess()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectT | null>(null)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editFallbackProject, setEditFallbackProject] =
    useState<ProjectT | null>(null)
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PROJECTS_LIMIT

  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const { data, isLoading, isFetching, isError } = useQuery(
    projectsQueryOptions({
      limit,
      page,
      search: q.trim() ? q.trim() : undefined,
    }),
  )

  const projects = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

  useEffect(() => {
    if (isLoading || isFetching || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, isLoading, isFetching, data])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }

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
        <p className="text-sm text-muted-foreground">
          {t('errors.loadFailed')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <ProjectSectionTabs active="projects" compact />

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ListPageSearchInput
          className="w-full sm:max-w-md"
          value={inputValue}
          onChange={setInputValue}
          onSearch={submitSearch}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
        />
        {canCreateProjects ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 self-end sm:self-auto"
          >
            <Plus className="size-4" />
            {t('actions.create')}
          </Button>
        ) : null}
      </div>

      <Card
        variant="list"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table
            className="w-full min-w-[880px] table-fixed border-separate border-spacing-0"
            containerClassName="h-full min-h-0 overflow-auto"
          >
            <TableHeader className={stickyTableHeaderClassName}>
              <TableRow className="hover:bg-muted">
                <TableHead className="w-[14%]">
                  {t('table.columns.projectCode')}
                </TableHead>
                <TableHead className="w-[20%]">
                  {t('table.columns.projectName')}
                </TableHead>
                <TableHead className="w-[12%]">
                  {t('table.columns.projectType')}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t('table.columns.investor')}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t('table.columns.manager')}
                </TableHead>
                <TableHead className="w-32">
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
                    colSpan={7}
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
                      className="w-[20%]"
                    />
                    <ExpandableTextCell
                      text={project.projectType}
                      className="w-[12%]"
                    />
                    <ExpandableTextCell
                      text={project.investor}
                      className="w-[14%]"
                    />
                    <ExpandableTextCell
                      text={formatProjectManagerName(project)}
                      className="w-[14%]"
                    />
                    <TableCell className="w-32 align-top">
                      <ProjectStatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="w-28 align-top">
                      <DataTableRowActions
                        row={toTableRow(project)}
                        onView={handleView}
                        onEdit={canUpdateProjects ? handleEdit : undefined}
                        onDelete={canDeleteProjects ? handleDelete : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="shrink-0">
        <ListPagePagination
          page={safePage}
          totalPages={totalPages}
          limit={limit}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageChange={(nextPage) => {
            void navigate({
              search: (prev) => ({ ...prev, page: nextPage }),
              replace: true,
            })
          }}
          onLimitChange={(nextLimit) => {
            void navigate({
              search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
              replace: true,
            })
          }}
        />
      </div>

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
