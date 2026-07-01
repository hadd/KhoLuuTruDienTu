import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveFondDeleteDialog } from '@/features/archive-fond/components/ArchiveFondDeleteDialog'
import { ArchiveFondFormDialog } from '@/features/archive-fond/components/ArchiveFondFormDialog'
import { archiveFondsQueryOptions } from '@/features/archive-fond/queries'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { env } from '@/lib/utils/env'

const routeApi = getRouteApi('/app/archive-fonds/')

function toTableRow(fond: ArchiveFondT): Row<ArchiveFondT> {
  return { original: fond } as Row<ArchiveFondT>
}

export function ArchiveFondManagementPage() {
  const { t } = useTranslation('archive-fond')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedFond, setSelectedFond] = useState<ArchiveFondT | null>(null)

  const { data: fonds = [], isPending, isFetching, isError } = useQuery(
    archiveFondsQueryOptions({ search: q }),
  )

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const debouncedNavigate = useDebouncedCallback((next: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: next.trim() ? next.trim() : undefined,
      }),
      replace: true,
    })
  }, 300)

  function handleSearchChange(raw: string) {
    setInputValue(raw)
    if (env.USER_SEARCH_MODE === 'debounce') {
      debouncedNavigate(raw)
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (env.USER_SEARCH_MODE === 'enter' && event.key === 'Enter') {
      void navigate({
        search: (prev) => ({
          ...prev,
          q: inputValue.trim() ? inputValue.trim() : undefined,
        }),
        replace: true,
      })
    }
  }

  const handleCreate = () => {
    setSelectedFond(null)
    setFormOpen(true)
  }

  const handleEdit = (fond: ArchiveFondT) => {
    setSelectedFond(fond)
    setFormOpen(true)
  }

  const handleDelete = (fond: ArchiveFondT) => {
    setSelectedFond(fond)
    setDeleteOpen(true)
  }

  const showInitialLoading = isPending && fonds.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button type="button" onClick={handleCreate}>
          <Plus className="size-4" />
          {t('actions.create')}
        </Button>
      </div>

      <div className="shrink-0">
        <Input
          className="max-w-md border-input bg-background"
          placeholder={t('search.placeholder')}
          value={inputValue}
          onChange={(event) => handleSearchChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-label={t('search.placeholder')}
        />
      </div>

      {isError && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
        </div>
      )}

      <Card
        variant="list"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {isFetching && !showInitialLoading && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center bg-background/60 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {showInitialLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <Table className="w-full min-w-[960px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[10%]">
                  {t('table.columns.id')}
                </TableHead>
                <TableHead className="w-[18%]">
                  {t('table.columns.fondName')}
                </TableHead>
                <TableHead className="w-[18%]">
                  {t('table.columns.archiveAgency')}
                </TableHead>
                <TableHead className="w-[28%]">
                  {t('table.columns.adminstrativeHistory')}
                </TableHead>
                <TableHead className="w-[14%]">
                  {t('table.columns.fondType')}
                </TableHead>
                <TableHead className="w-24 text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fonds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                fonds.map((fond) => (
                  <TableRow key={fond.id}>
                    <TableCell className="align-top font-medium">
                      <TextBlock lines={1}>{fond.id}</TextBlock>
                    </TableCell>
                    <TableCell className="align-top">
                      <TextBlock lines={2}>{fond.fondName}</TextBlock>
                    </TableCell>
                    <TableCell className="align-top">
                      <TextBlock lines={2}>{fond.archiveAgency}</TextBlock>
                    </TableCell>
                    <TableCell className="align-top">
                      <TextBlock lines={2}>
                        {fond.adminstrativeHistory}
                      </TextBlock>
                    </TableCell>
                    <TableCell className="align-top">
                      <TextBlock lines={1}>{fond.fondType}</TextBlock>
                    </TableCell>
                    <TableCell className="align-top">
                      <DataTableRowActions
                        row={toTableRow(fond)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </div>
      </Card>

      <ArchiveFondFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedFond(null)
        }}
        fond={selectedFond}
      />

      <ArchiveFondDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedFond(null)
        }}
        fond={selectedFond}
      />
    </div>
  )
}
