import { useQuery } from '@tanstack/react-query'

import { useNavigate } from '@tanstack/react-router'

import { Loader2 } from 'lucide-react'

import { useState } from 'react'

import { useTranslation } from 'react-i18next'



import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'

import { Badge } from '@/components/ui/badge'

import { Card } from '@/components/ui/card'

import { Checkbox } from '@/components/ui/checkbox'

import {

  Table,

  TableBody,

  TableCell,

  TableHead,

  TableHeader,

  TableRow,

} from '@/components/ui/table'

import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'

import { archiveWarehouseUnassignedDossiersQueryOptions } from '@/features/archive-warehouse/queries'

import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'

import { formatDate } from '@/lib/utils/date'



type ArchiveWarehouseUnassignedSectionProps = {

  page?: number

  limit?: number

  search?: string

  onPageChange?: (page: number) => void

  onLimitChange?: (limit: number) => void

}



export function ArchiveWarehouseUnassignedSection({

  page = 1,

  limit = DEFAULT_LIST_PAGE_LIMIT,

  search,

  onPageChange,

  onLimitChange,

}: ArchiveWarehouseUnassignedSectionProps) {

  const { t, i18n } = useTranslation('archive-warehouse')

  const navigate = useNavigate()

  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())



  const { data, isPending, isFetching } = useQuery(

    archiveWarehouseUnassignedDossiersQueryOptions({

      page,

      limit,

      search: search || undefined,

    }),

  )



  const items = data?.items ?? []

  const totalPages = Math.max(1, data?.totalPages ?? 1)

  const selectableIds = items.map((item) => item.id)

  const allSelected =

    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

  const someSelected =

    selectableIds.some((id) => selectedIds.has(id)) && !allSelected



  function openDossier(dossierId: string) {

    void navigate({

      to: '/app/archive-dossiers/$fondId/$dossierId',

      params: { fondId: UNASSIGNED_WAREHOUSE_FOND_ID, dossierId },

    })

  }



  function toggleDossierSelection(dossierId: string, checked: boolean) {

    const next = new Set(selectedIds)

    if (checked) {

      next.add(dossierId)

    } else {

      next.delete(dossierId)

    }

    setSelectedIds(next)

  }



  function toggleSelectAllOnPage(checked: boolean) {

    const next = new Set(selectedIds)

    if (checked) {

      selectableIds.forEach((id) => next.add(id))

    } else {

      selectableIds.forEach((id) => next.delete(id))

    }

    setSelectedIds(next)

  }



  if (isPending) {

    return (

      <div className="flex h-48 items-center justify-center">

        <Loader2 className="size-6 animate-spin text-muted-foreground" />

      </div>

    )

  }



  if (items.length === 0) {

    return (

      <Card className="p-8 text-center text-sm text-muted-foreground">

        {t('page.unassignedDossiersEmpty')}

      </Card>

    )

  }



  return (

    <div className="flex min-w-0 flex-col gap-3">

      <Card variant="list" className="overflow-hidden">

        <div className="overflow-x-auto">

          <Table className="w-full min-w-[720px]">

            <TableHeader>

              <TableRow className="bg-muted/50 hover:bg-muted/50">

                <TableHead className="w-10">

                  <Checkbox

                    checked={

                      allSelected ? true : someSelected ? 'indeterminate' : false

                    }

                    onCheckedChange={(checked) =>

                      toggleSelectAllOnPage(checked === true)

                    }

                    aria-label={t('table.selectAll')}

                  />

                </TableHead>

                <TableHead>{t('table.name')}</TableHead>

                <TableHead>{t('table.physicalLocation')}</TableHead>

                <TableHead>{t('table.documentCount')}</TableHead>

                <TableHead>{t('table.archivedAt')}</TableHead>

                <TableHead>{t('table.path')}</TableHead>

                <TableHead>{t('table.dossierType')}</TableHead>

                <TableHead>{t('table.archiveStorageState')}</TableHead>

              </TableRow>

            </TableHeader>

            <TableBody>

              {items.map((item) => (

                <TableRow

                  key={item.id}

                  className="cursor-pointer"

                  onClick={() => openDossier(item.id)}

                >

                  <TableCell

                    className="w-10"

                    onClick={(event) => event.stopPropagation()}

                  >

                    <Checkbox

                      checked={selectedIds.has(item.id)}

                      onCheckedChange={(checked) =>

                        toggleDossierSelection(item.id, checked === true)

                      }

                      aria-label={t('table.select')}

                    />

                  </TableCell>

                  <TableCell className="max-w-[180px] truncate font-medium">

                    {item.name}

                  </TableCell>

                  <TableCell>

                    {item.hasPhysicalPlacement ? (

                      <span className="text-sm">{item.physicalBoxName ?? '—'}</span>

                    ) : (

                      <Badge variant="secondary">

                        {t('table.physicalUnplaced')}

                      </Badge>

                    )}

                  </TableCell>

                  <TableCell>{item.documentCount}</TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">

                    {item.archivedAt

                      ? formatDate(item.archivedAt, 'P', dateLocale)

                      : '—'}

                  </TableCell>

                  <TableCell className="max-w-[160px] truncate text-muted-foreground">

                    {item.folderPath ?? '—'}

                  </TableCell>

                  <TableCell className="max-w-[120px] truncate">

                    {item.dossierTypeName ?? '—'}

                  </TableCell>

                  <TableCell>

                    <Badge variant="outline">

                      {t(`archiveStorageState.${item.archiveStorageState}`)}

                    </Badge>

                  </TableCell>

                </TableRow>

              ))}

            </TableBody>

          </Table>

        </div>

      </Card>



      {onPageChange && onLimitChange ? (

        <ListPagePagination

          page={page}

          totalPages={totalPages}

          limit={limit}

          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}

          onPageChange={onPageChange}

          onLimitChange={onLimitChange}

        />

      ) : null}



      {isFetching && !isPending ? (

        <div className="flex justify-center py-2">

          <Loader2 className="size-4 animate-spin text-muted-foreground" />

        </div>

      ) : null}

    </div>

  )

}


