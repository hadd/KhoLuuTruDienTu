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
import { DossierTypeDeleteDialog } from '@/features/dossier-type/components/DossierTypeDeleteDialog'
import { DossierTypeFormDialog } from '@/features/dossier-type/components/DossierTypeFormDialog'
import { useDossierTypeAccess } from '@/features/dossier-type/hooks/useDossierTypeAccess'
import { dossierTypesQueryOptions } from '@/features/dossier-type/queries'
import type { DossierTypeT } from '@/features/dossier-type/types'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { env } from '@/lib/utils/env'

const routeApi = getRouteApi('/app/dossier-types/')

function toTableRow(dossierType: DossierTypeT): Row<DossierTypeT> {
  return { original: dossierType } as Row<DossierTypeT>
}

export function DossierTypeManagementPage() {
  const { t } = useTranslation('dossier-type')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDossierType, setSelectedDossierType] =
    useState<DossierTypeT | null>(null)
  const {
    canCreateDossierTypes,
    canUpdateDossierTypes,
    canDeleteDossierTypes,
  } = useDossierTypeAccess()

  const { data: dossierTypes = [], isPending, isFetching, isError } = useQuery(
    dossierTypesQueryOptions({ search: q }),
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
    setSelectedDossierType(null)
    setFormOpen(true)
  }

  const handleEdit = (dossierType: DossierTypeT) => {
    setSelectedDossierType(dossierType)
    setFormOpen(true)
  }

  const handleDelete = (dossierType: DossierTypeT) => {
    setSelectedDossierType(dossierType)
    setDeleteOpen(true)
  }

  const showInitialLoading = isPending && dossierTypes.length === 0

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
        <Button
          type="button"
          onClick={handleCreate}
          disabled={!canCreateDossierTypes}
        >
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
            <Table className="w-full min-w-[720px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[15%]">
                    {t('table.columns.id')}
                  </TableHead>
                  <TableHead className="w-[25%]">
                    {t('table.columns.name')}
                  </TableHead>
                  <TableHead className="w-[45%]">
                    {t('table.columns.description')}
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    {t('table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossierTypes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  dossierTypes.map((dossierType) => (
                    <TableRow key={dossierType.id}>
                      <TableCell className="align-top font-medium">
                        <TextBlock lines={1}>{dossierType.id}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{dossierType.name}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>
                          {dossierType.description}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <DataTableRowActions
                          row={toTableRow(dossierType)}
                          onEdit={
                            canUpdateDossierTypes ? handleEdit : undefined
                          }
                          onDelete={
                            canDeleteDossierTypes ? handleDelete : undefined
                          }
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

      <DossierTypeFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedDossierType(null)
        }}
        dossierType={selectedDossierType}
      />

      <DossierTypeDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedDossierType(null)
        }}
        dossierType={selectedDossierType}
      />
    </div>
  )
}
