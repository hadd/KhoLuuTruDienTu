import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import {
  archiveWarehouseDossierTypesQueryOptions,
  archiveWarehouseDossiersQueryOptions,
  archiveWarehouseFondSummaryQueryOptions,
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/$fondId/')

const ALL_YEARS = 'ALL'
const ALL_FONDS = 'ALL'
const ALL_TYPES = 'ALL'

type SearchMode = 'metadata' | 'content'

export function ArchiveWarehouseDossiersPage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { fondId } = routeApi.useParams()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const mode: SearchMode =
    search.mode === 'content' || search.contentSearch === true
      ? 'content'
      : 'metadata'

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const year = search.year
  const q = search.q ?? ''
  const dossierName = search.dossierName ?? ''
  const documentName = search.documentName ?? ''
  const searchFondId = search.searchFondId
  const dossierTypeId = search.dossierTypeId
  const editorName = search.editorName ?? ''
  const editCompletedAtFrom = search.editCompletedAtFrom ?? ''
  const editCompletedAtTo = search.editCompletedAtTo ?? ''
  const archivedAtFrom = search.archivedAtFrom ?? ''
  const archivedAtTo = search.archivedAtTo ?? ''

  const [contentQ, setContentQ] = useState(q)
  const [draftDossierName, setDraftDossierName] = useState(dossierName)
  const [draftDocumentName, setDraftDocumentName] = useState(documentName)
  const [draftSearchFondId, setDraftSearchFondId] = useState(
    searchFondId ?? fondId,
  )
  const [draftDossierTypeId, setDraftDossierTypeId] = useState(
    dossierTypeId ?? ALL_TYPES,
  )
  const [draftEditorName, setDraftEditorName] = useState(editorName)
  const [draftEditFrom, setDraftEditFrom] = useState(editCompletedAtFrom)
  const [draftEditTo, setDraftEditTo] = useState(editCompletedAtTo)
  const [draftArchivedFrom, setDraftArchivedFrom] = useState(archivedAtFrom)
  const [draftArchivedTo, setDraftArchivedTo] = useState(archivedAtTo)

  useEffect(() => {
    setContentQ(q)
  }, [q])

  useEffect(() => {
    setDraftDossierName(dossierName)
    setDraftDocumentName(documentName)
    setDraftSearchFondId(searchFondId ?? fondId)
    setDraftDossierTypeId(dossierTypeId ?? ALL_TYPES)
    setDraftEditorName(editorName)
    setDraftEditFrom(editCompletedAtFrom)
    setDraftEditTo(editCompletedAtTo)
    setDraftArchivedFrom(archivedAtFrom)
    setDraftArchivedTo(archivedAtTo)
  }, [
    archivedAtFrom,
    archivedAtTo,
    documentName,
    dossierName,
    dossierTypeId,
    editCompletedAtFrom,
    editCompletedAtTo,
    editorName,
    fondId,
    searchFondId,
  ])

  const { data: fondsData } = useQuery(archiveWarehouseFondsQueryOptions())
  const { data: dossierTypesData } = useQuery(
    archiveWarehouseDossierTypesQueryOptions(),
  )
  const fondName =
    fondsData?.items.find((fond) => fond.id === fondId)?.fondName ?? fondId

  const metadataActive = useMemo(() => {
    if (mode !== 'metadata') return false
    return Boolean(
      dossierName.trim() ||
        documentName.trim() ||
        editorName.trim() ||
        editCompletedAtFrom ||
        editCompletedAtTo ||
        archivedAtFrom ||
        archivedAtTo ||
        dossierTypeId ||
        (searchFondId && searchFondId !== fondId) ||
        searchFondId === ALL_FONDS,
    )
  }, [
    archivedAtFrom,
    archivedAtTo,
    documentName,
    dossierName,
    dossierTypeId,
    editCompletedAtFrom,
    editCompletedAtTo,
    editorName,
    fondId,
    mode,
    searchFondId,
  ])

  const effectiveSearchFondId =
    searchFondId === ALL_FONDS
      ? undefined
      : (searchFondId ?? (metadataActive ? fondId : undefined))

  const listParams = {
    fondId,
    page,
    limit,
    search: undefined,
    year,
    status: 'ARCHIVED' as const,
  }

  const summaryParams = { fondId, status: 'ARCHIVED' as const }

  const searchParams =
    mode === 'content' && q.trim()
      ? {
          mode: 'content' as const,
          q: q.trim(),
          fondId,
          limit,
          offset: (page - 1) * limit,
        }
      : mode === 'metadata' && metadataActive
        ? {
            mode: 'metadata' as const,
            dossierName: dossierName.trim() || undefined,
            documentName: documentName.trim() || undefined,
            fondId: effectiveSearchFondId,
            dossierTypeId: dossierTypeId || undefined,
            editorName: editorName.trim() || undefined,
            editCompletedAtFrom: editCompletedAtFrom || undefined,
            editCompletedAtTo: editCompletedAtTo || undefined,
            archivedAtFrom: archivedAtFrom || undefined,
            archivedAtTo: archivedAtTo || undefined,
            limit,
            offset: (page - 1) * limit,
          }
        : null

  const {
    data: summaryData,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery(archiveWarehouseFondSummaryQueryOptions(summaryParams))

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery({
    ...archiveWarehouseDossiersQueryOptions(listParams),
    enabled: !searchParams,
  })

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
    isError: isSearchError,
    error: searchError,
  } = useQuery(archiveWarehouseSearchQueryOptions(searchParams))

  const isSearchActive = Boolean(searchParams)
  const items = isSearchActive ? [] : (data?.items ?? [])
  const searchItems = isSearchActive ? (searchData?.items ?? []) : []
  const totalPages = Math.max(
    1,
    isSearchActive
      ? Math.ceil((searchData?.total ?? 0) / limit) || 1
      : (data?.totalPages ?? 1),
  )
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const listLoading = isSearchActive
    ? isSearchPending || isSearchFetching
    : isPending || isFetching

  useEffect(() => {
    if (listLoading) return
    if (isSearchActive ? !searchData : !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [
    safePage,
    page,
    navigate,
    listLoading,
    data,
    searchData,
    isSearchActive,
  ])

  function setMode(next: SearchMode) {
    void navigate({
      search: (prev) => ({
        ...prev,
        mode: next,
        contentSearch: undefined,
        page: 1,
        q: next === 'content' ? prev.q : undefined,
        dossierName: next === 'metadata' ? prev.dossierName : undefined,
        documentName: next === 'metadata' ? prev.documentName : undefined,
      }),
      replace: true,
    })
  }

  function submitMetadataSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        mode: 'metadata',
        contentSearch: undefined,
        page: 1,
        q: undefined,
        dossierName: draftDossierName.trim() || undefined,
        documentName: draftDocumentName.trim() || undefined,
        searchFondId:
          draftSearchFondId === ALL_FONDS
            ? ALL_FONDS
            : draftSearchFondId === fondId
              ? undefined
              : draftSearchFondId || undefined,
        dossierTypeId:
          draftDossierTypeId === ALL_TYPES ? undefined : draftDossierTypeId,
        editorName: draftEditorName.trim() || undefined,
        editCompletedAtFrom: draftEditFrom || undefined,
        editCompletedAtTo: draftEditTo || undefined,
        archivedAtFrom: draftArchivedFrom || undefined,
        archivedAtTo: draftArchivedTo || undefined,
      }),
      replace: true,
    })
  }

  function clearMetadataSearch() {
    setDraftDossierName('')
    setDraftDocumentName('')
    setDraftSearchFondId(fondId)
    setDraftDossierTypeId(ALL_TYPES)
    setDraftEditorName('')
    setDraftEditFrom('')
    setDraftEditTo('')
    setDraftArchivedFrom('')
    setDraftArchivedTo('')
    void navigate({
      search: (prev) => ({
        ...prev,
        mode: 'metadata',
        page: 1,
        q: undefined,
        dossierName: undefined,
        documentName: undefined,
        searchFondId: undefined,
        dossierTypeId: undefined,
        editorName: undefined,
        editCompletedAtFrom: undefined,
        editCompletedAtTo: undefined,
        archivedAtFrom: undefined,
        archivedAtTo: undefined,
      }),
      replace: true,
    })
  }

  function submitContentSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        mode: 'content',
        contentSearch: undefined,
        page: 1,
        q: contentQ.trim() || undefined,
      }),
      replace: true,
    })
  }

  function handleYearFilter(next: string) {
    void navigate({
      search: (prev) => ({
        ...prev,
        year: next === ALL_YEARS ? undefined : Number(next),
        page: 1,
      }),
      replace: true,
    })
  }

  function openDossierDetail(
    dossierId: string,
    options?: {
      fondId?: string | null
      fileName?: string | null
      page?: number | null
      bbox?: number[] | null
    },
  ) {
    const highlightBbox =
      options?.bbox && options.bbox.length >= 4
        ? options.bbox.slice(0, 4).join(',')
        : undefined

    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: { fondId: options?.fondId || fondId, dossierId },
      search: {
        fileName: options?.fileName ?? undefined,
        highlightPage:
          options?.page && options.page > 0 ? options.page : undefined,
        highlightBbox,
      },
    })
  }

  const forbiddenMessage =
    isSummaryError || isListError || isSearchError
      ? translateError(
          (summaryError ?? listError ?? searchError) instanceof Error
            ? (summaryError ?? listError ?? searchError)
            : new Error(t('errors.fondForbidden')),
        )
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/archive-dossiers">
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            {t('page.backToFonds')}
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{fondName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('page.fondDossiersDescription')}
          </p>
        </div>
      </div>

      {forbiddenMessage ? (
        <Card className="border-destructive p-8 text-center text-sm text-destructive">
          {forbiddenMessage}
        </Card>
      ) : null}

      {!forbiddenMessage && summaryData ? (
        <ArchiveWarehouseStatCards summary={summaryData} />
      ) : null}

      {!forbiddenMessage ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'metadata' ? 'default' : 'outline'}
              onClick={() => setMode('metadata')}
            >
              {t('search.modeMetadata')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'content' ? 'default' : 'outline'}
              onClick={() => setMode('content')}
            >
              {t('search.modeContent')}
            </Button>
          </div>

          {mode === 'metadata' ? (
            <Card className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                {t('search.metadataHint')}
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wh-dossier-name">{t('search.dossierName')}</Label>
                  <Input
                    id="wh-dossier-name"
                    value={draftDossierName}
                    onChange={(e) => setDraftDossierName(e.target.value)}
                    placeholder={t('search.dossierNamePlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-document-name">{t('search.documentName')}</Label>
                  <Input
                    id="wh-document-name"
                    value={draftDocumentName}
                    onChange={(e) => setDraftDocumentName(e.target.value)}
                    placeholder={t('search.documentNamePlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('search.fond')}</Label>
                  <Select
                    value={draftSearchFondId}
                    onValueChange={setDraftSearchFondId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('search.fond')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FONDS}>
                        {t('search.allFonds')}
                      </SelectItem>
                      {(fondsData?.items ?? []).map((fond) => (
                        <SelectItem key={fond.id} value={fond.id}>
                          {fond.fondName}
                          {fond.id === fondId
                            ? ` (${t('search.currentFond')})`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('search.dossierType')}</Label>
                  <Select
                    value={draftDossierTypeId}
                    onValueChange={setDraftDossierTypeId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('search.dossierType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TYPES}>
                        {t('search.allDossierTypes')}
                      </SelectItem>
                      {(dossierTypesData?.items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-editor">{t('search.editorName')}</Label>
                  <Input
                    id="wh-editor"
                    value={draftEditorName}
                    onChange={(e) => setDraftEditorName(e.target.value)}
                    placeholder={t('search.editorNamePlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('filters.year')}</Label>
                  <Select
                    value={year != null ? String(year) : ALL_YEARS}
                    onValueChange={handleYearFilter}
                    disabled={metadataActive}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('filters.year')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_YEARS}>
                        {t('filters.allYears')}
                      </SelectItem>
                      {(summaryData?.availableYears ?? []).map((itemYear) => (
                        <SelectItem key={itemYear} value={String(itemYear)}>
                          {itemYear}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-edit-from">{t('search.editCompletedFrom')}</Label>
                  <Input
                    id="wh-edit-from"
                    type="date"
                    value={draftEditFrom}
                    onChange={(e) => setDraftEditFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-edit-to">{t('search.editCompletedTo')}</Label>
                  <Input
                    id="wh-edit-to"
                    type="date"
                    value={draftEditTo}
                    onChange={(e) => setDraftEditTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-arch-from">{t('search.archivedFrom')}</Label>
                  <Input
                    id="wh-arch-from"
                    type="date"
                    value={draftArchivedFrom}
                    onChange={(e) => setDraftArchivedFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wh-arch-to">{t('search.archivedTo')}</Label>
                  <Input
                    id="wh-arch-to"
                    type="date"
                    value={draftArchivedTo}
                    onChange={(e) => setDraftArchivedTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={submitMetadataSearch}>
                  {t('search.submit')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearMetadataSearch}
                >
                  {t('search.clear')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              <ListPageSearchInput
                value={contentQ}
                onChange={setContentQ}
                onSearch={submitContentSearch}
                placeholder={t('search.contentPlaceholder')}
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="size-3.5" aria-hidden />
                {t('page.contentSearchHint')}
                {searchData?.took_ms != null
                  ? ` · ${t('page.searchTook', { ms: searchData.took_ms })}`
                  : null}
              </p>
            </div>
          )}

          {listLoading && items.length === 0 && searchItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!listLoading &&
          !isSearchActive &&
          summaryData?.dossierCount === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t('page.fondEmpty')}
            </Card>
          ) : null}

          {!listLoading &&
          !isSearchActive &&
          summaryData &&
          summaryData.dossierCount > 0 &&
          items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {year != null ? t('page.noMatch') : t('page.fondEmpty')}
            </Card>
          ) : null}

          {!listLoading && isSearchActive && searchItems.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {searchData?.message ?? t('page.noMatch')}
            </Card>
          ) : null}

          {mode === 'content' && searchItems.length > 0 ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto">
              {searchItems.map((hit) => (
                <button
                  key={`${hit.entityType}-${hit.entityId}`}
                  type="button"
                  className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
                  onClick={() =>
                    openDossierDetail(hit.entityId, {
                      fondId: hit.fondId,
                      fileName: hit.matches?.[0]?.fileName,
                      page: hit.matches?.[0]?.page,
                      bbox: hit.matches?.[0]?.bbox,
                    })
                  }
                >
                  <p className="font-medium text-foreground">{hit.title}</p>
                  {hit.snippet ? (
                    <p
                      className="mt-2 text-sm text-muted-foreground [&_em]:font-semibold [&_em]:not-italic [&_em]:text-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:font-semibold [&_mark]:text-foreground"
                      dangerouslySetInnerHTML={{ __html: hit.snippet }}
                    />
                  ) : null}
                  {hit.matches?.[0]?.fileName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hit.matches[0].fileName}
                      {hit.matches[0].page != null
                        ? ` · trang ${hit.matches[0].page}`
                        : ''}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {(mode === 'metadata' && searchItems.length > 0) ||
          (!isSearchActive && items.length > 0) ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.name')}</TableHead>
                    <TableHead>{t('table.dossierType')}</TableHead>
                    <TableHead>{t('table.fond')}</TableHead>
                    <TableHead>{t('table.editor')}</TableHead>
                    <TableHead>{t('table.editCompletedAt')}</TableHead>
                    <TableHead>{t('table.archivedAt')}</TableHead>
                    <TableHead>{t('table.documentCount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSearchActive
                    ? searchItems.map((hit) => (
                        <TableRow
                          key={hit.entityId}
                          className="cursor-pointer"
                          onClick={() =>
                            openDossierDetail(hit.entityId, {
                              fondId: hit.fondId,
                            })
                          }
                        >
                          <TableCell className="font-medium">{hit.title}</TableCell>
                          <TableCell>{hit.dossierTypeName ?? '—'}</TableCell>
                          <TableCell>{hit.fondName ?? '—'}</TableCell>
                          <TableCell>{hit.editorName ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {hit.editCompletedAt
                              ? formatDate(
                                  hit.editCompletedAt,
                                  'PPp',
                                  i18n.language,
                                )
                              : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {hit.archivedAt
                              ? formatDate(hit.archivedAt, 'PPp', i18n.language)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {hit.fileNames?.length
                              ? hit.fileNames.slice(0, 2).join(', ')
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    : items.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => openDossierDetail(item.id)}
                        >
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>{item.fondName ?? fondName}</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell>—</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {item.archivedAt
                              ? formatDate(item.archivedAt, 'PPp', i18n.language)
                              : '—'}
                          </TableCell>
                          <TableCell>{item.documentCount}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {items.length > 0 || searchItems.length > 0 ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  )
}
