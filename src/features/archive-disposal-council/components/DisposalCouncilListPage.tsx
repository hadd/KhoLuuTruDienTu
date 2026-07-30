import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createDisposalCouncil,
  updateDisposalCouncilMembers,
} from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import {
  availableCatalogsForCouncilQueryOptions,
  disposalCouncilDetailQueryOptions,
  disposalCouncilHistoryQueryOptions,
  disposalCouncilsQueryKeyPrefix,
  disposalCouncilsQueryOptions,
  disposalSettingsQueryOptions,
} from '@/features/archive-disposal-council/queries'
import type {
  DisposalCouncilMemberInputT,
  DisposalCouncilMemberPositionRoleT,
  DisposalCouncilMemberRepresentationTypeT,
} from '@/features/archive-disposal-council/types'
import { UserSingleSelectField } from '@/features/group/components/UserSingleSelectField'
import { adminUsersQueryOptions } from '@/features/user/queries'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-warehouse/')

const COUNCIL_DIALOG_CONTENT_CLASS =
  '!flex max-h-[min(90dvh,900px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'

const POSITION_ROLES: Array<DisposalCouncilMemberPositionRoleT> = [
  'CHAIR',
  'SECRETARY',
  'MEMBER',
]

const REPRESENTATION_TYPES: Array<DisposalCouncilMemberRepresentationTypeT> = [
  'LEADERSHIP',
  'ARCHIVE_DEPT',
  'SPECIALIST_DEPT',
  'OTHER',
]

function emptyMemberRow(index: number): DisposalCouncilMemberInputT {
  return {
    userId: '',
    positionRole: index === 0 ? 'CHAIR' : 'MEMBER',
    representationType: index === 1 ? 'ARCHIVE_DEPT' : index === 2 ? 'SPECIALIST_DEPT' : 'OTHER',
    sortOrder: index,
  }
}

function createDefaultMemberRows(): Array<DisposalCouncilMemberInputT> {
  return Array.from({ length: 5 }, (_, index) => emptyMemberRow(index))
}

export function DisposalCouncilListPage() {
  const { t } = useTranslation('archive-disposal-council')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const language = useCurrentLanguage()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const { canReadCouncil, canCreateCouncil, canUpdateCouncil } = useDisposalCouncilAccess()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const selectedCouncilId = search.disposalCouncilId ?? null

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [catalogId, setCatalogId] = useState('')
  const [memberDrafts, setMemberDrafts] = useState<Array<DisposalCouncilMemberInputT>>(
    createDefaultMemberRows(),
  )
  const [changeReason, setChangeReason] = useState('')
  const [copyFromCouncilId, setCopyFromCouncilId] = useState<string>('')

  const { data: settings } = useQuery(
    disposalSettingsQueryOptions(),
  )
  const { data: councilList, isPending: isListPending } = useQuery(
    disposalCouncilsQueryOptions({ page, limit }),
  )
  const { data: councilDetail, isPending: isDetailPending } = useQuery(
    disposalCouncilDetailQueryOptions(selectedCouncilId),
  )
  const { data: councilHistory } = useQuery(
    disposalCouncilHistoryQueryOptions(selectedCouncilId),
  )
  const { data: availableCatalogs } = useQuery(availableCatalogsForCouncilQueryOptions())
  const { data: usersData, isPending: isUsersPending } = useQuery(
    adminUsersQueryOptions({ page: 1, limit: 200 }),
  )

  const activeUsers = useMemo(
    () => (usersData?.data ?? []).filter((user) => user.active),
    [usersData?.data],
  )

  const councils = councilList?.items ?? []
  const totalPages = councilList?.totalPages ?? 1

  const isCouncilLocked = Boolean(councilDetail?.council.reviewResult)
  const isReviewStarted = Boolean(councilDetail?.council.reviewStartedAt)
  const canEditMembers = canUpdateCouncil && !isCouncilLocked

  useEffect(() => {
    if (!copyFromCouncilId || !createOpen) return
    const source = councils.find((item) => item.id === copyFromCouncilId)
    if (!source) return
    void queryClient
      .fetchQuery(disposalCouncilDetailQueryOptions(copyFromCouncilId))
      .then((detail) => {
        setMemberDrafts(
          detail.members.map((member, index) => ({
            userId: member.userId,
            positionRole: member.positionRole,
            representationType: member.representationType,
            sortOrder: index,
          })),
        )
      })
      .catch(() => undefined)
  }, [copyFromCouncilId, createOpen, councils, queryClient])

  const invalidateCouncilQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: disposalCouncilsQueryKeyPrefix })
    await queryClient.invalidateQueries({ queryKey: ['archive-disposal', 'available-catalogs-for-council'] })
    if (selectedCouncilId) {
      await queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'council', selectedCouncilId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'council-history', selectedCouncilId],
      })
    }
  }

  const createMutation = useMutation({
    mutationFn: createDisposalCouncil,
    onSuccess: async (result) => {
      toast.success(t('form.save'))
      setCreateOpen(false)
      setCatalogId('')
      setMemberDrafts(createDefaultMemberRows())
      setCopyFromCouncilId('')
      await invalidateCouncilQueries()
      void navigate({
        search: (prev) => ({ ...prev, disposalCouncilId: result.council.id }),
      })
      if (result.warnings?.length) {
        toast.warning(t('warnings.conflictTitle'))
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const updateMutation = useMutation({
    mutationFn: (input: { members: Array<DisposalCouncilMemberInputT>; reason?: string }) =>
      updateDisposalCouncilMembers(selectedCouncilId!, input),
    onSuccess: async (result) => {
      toast.success(t('form.save'))
      setEditOpen(false)
      setChangeReason('')
      await invalidateCouncilQueries()
      if (result.warnings?.length) {
        toast.warning(t('warnings.conflictTitle'))
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  function openEditDialog() {
    if (!councilDetail) return
    setMemberDrafts(
      councilDetail.members.map((member, index) => ({
        userId: member.userId,
        positionRole: member.positionRole,
        representationType: member.representationType,
        sortOrder: index,
      })),
    )
    setChangeReason('')
    setEditOpen(true)
  }

  function submitCreate() {
    if (!catalogId) return
    createMutation.mutate({
      catalogId,
      members: memberDrafts.filter((member) => member.userId),
      copiedFromCouncilId: copyFromCouncilId || null,
    })
  }

  function submitUpdate() {
    updateMutation.mutate({
      members: memberDrafts.filter((member) => member.userId),
      reason: changeReason || undefined,
    })
  }

  function renderMemberEditor(
    members: Array<DisposalCouncilMemberInputT>,
    onChange: (next: Array<DisposalCouncilMemberInputT>) => void,
    showReason: boolean,
  ) {
    return (
      <div className="space-y-3">
        {members.map((member, index) => (
          <div
            key={`member-row-${index}`}
            className="grid gap-2 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_140px_180px_auto]"
          >
            <div className="min-w-0">
              <UserSingleSelectField
                label={t('form.memberUser')}
              placeholder={t('form.memberUserPlaceholder')}
              searchPlaceholder={t('form.memberUserPlaceholder')}
              emptyLabel={t('form.memberUserPlaceholder')}
              noResultsLabel={t('form.memberUserPlaceholder')}
              loadingLabel={t('form.memberUserPlaceholder')}
              users={activeUsers}
              isLoading={isUsersPending}
              selectedId={member.userId}
              onSelect={(userId) => {
                const next = [...members]
                next[index] = { ...next[index], userId }
                onChange(next)
              }}
            />
            </div>
            <div className="space-y-1">
              <Label>{t('form.positionRole')}</Label>
              <Select
                value={member.positionRole}
                onValueChange={(value) => {
                  const next = [...members]
                  next[index] = {
                    ...next[index],
                    positionRole: value as DisposalCouncilMemberPositionRoleT,
                  }
                  onChange(next)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`roles.position.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('form.representationType')}</Label>
              <Select
                value={member.representationType}
                onValueChange={(value) => {
                  const next = [...members]
                  next[index] = {
                    ...next[index],
                    representationType: value as DisposalCouncilMemberRepresentationTypeT,
                  }
                  onChange(next)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPRESENTATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`roles.representation.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={members.length <= 1}
                onClick={() => onChange(members.filter((_, rowIndex) => rowIndex !== index))}
              >
                {t('form.removeMember')}
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...members, emptyMemberRow(members.length)])}
        >
          <Plus className="mr-2 size-4" />
          {t('form.addMember')}
        </Button>
        {showReason ? (
          <div className="space-y-1">
            <Label htmlFor="member-change-reason">{t('form.reason')}</Label>
            <Textarea
              id="member-change-reason"
              value={changeReason}
              placeholder={t('form.reasonPlaceholder')}
              onChange={(event) => setChangeReason(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('form.reasonRequired')}</p>
          </div>
        ) : null}
      </div>
    )
  }

  if (!canReadCouncil) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('errors.noPermission')}
      </div>
    )
  }

  if (settings && !settings.councilReviewEnabled) {
    return (
      <Alert>
        <AlertTitle>{t('settings.councilReviewEnabled')}</AlertTitle>
        <AlertDescription>{t('settings.councilReviewDisabledHint')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {canCreateCouncil ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            {t('list.create')}
          </Button>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-auto p-3">
          {isListPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : councils.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('list.empty')}</p>
          ) : (
            <div className="space-y-1">
              {councils.map((council) => (
                <button
                  key={council.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selectedCouncilId === council.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    void navigate({
                      search: (prev) => ({ ...prev, disposalCouncilId: council.id }),
                    })
                  }}
                >
                  <div className="font-medium">{council.code}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{council.catalogName}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">
                      {tDisposal(`proposal.status.${council.catalogStatus}`)}
                    </Badge>
                    {council.reviewStartedAt ? (
                      <Badge variant="secondary">{t('status.reviewStarted')}</Badge>
                    ) : null}
                    {council.reviewResult ? (
                      <Badge>{t(`status.reviewResult.${council.reviewResult}`)}</Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={(nextPage) => {
              void navigate({ search: (prev) => ({ ...prev, page: nextPage }) })
            }}
            onLimitChange={(nextLimit) => {
              void navigate({
                search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
              })
            }}
          />
        </Card>

        <Card className="min-h-0 overflow-auto p-4">
          {!selectedCouncilId ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('list.selectHint')}
            </p>
          ) : isDetailPending ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : councilDetail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{councilDetail.council.code}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('list.catalog')}: {councilDetail.council.catalogName} (
                    {councilDetail.council.catalogCode})
                  </p>
                </div>
                {canEditMembers ? (
                  <Button variant="outline" onClick={openEditDialog}>
                    <Save className="mr-2 size-4" />
                    {t('form.editTitle')}
                  </Button>
                ) : null}
              </div>

              {isCouncilLocked ? (
                <Alert>
                  <AlertTitle>{t('status.reviewLocked')}</AlertTitle>
                </Alert>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-medium">{t('list.members')}</h4>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2">{t('form.memberUser')}</th>
                        <th className="px-3 py-2">{t('form.positionRole')}</th>
                        <th className="px-3 py-2">{t('form.representationType')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {councilDetail.members.map((member) => (
                        <tr key={member.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{member.fullName}</div>
                            <div className="text-xs text-muted-foreground">{member.email}</div>
                          </td>
                          <td className="px-3 py-2">{t(`roles.position.${member.positionRole}`)}</td>
                          <td className="px-3 py-2">
                            {t(`roles.representation.${member.representationType}`)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium">{t('list.history')}</h4>
                {!councilHistory?.items.length ? (
                  <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {councilHistory.items.map((item) => (
                      <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="font-medium">{t(`history.action.${item.action}`)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t('history.by', {
                            name: item.changedByName,
                            date: formatDate(item.createdAt, 'PPp', language),
                          })}
                        </div>
                        {item.reason ? (
                          <div className="mt-1 text-xs">{t('history.reason', { reason: item.reason })}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={COUNCIL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>{t('form.title')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('form.catalog')}</Label>
                <Select value={catalogId} onValueChange={setCatalogId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.catalogPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableCatalogs?.items ?? []).map((catalog) => (
                      <SelectItem key={catalog.id} value={catalog.id}>
                        {catalog.name} ({catalog.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!availableCatalogs?.items.length ? (
                  <p className="text-xs text-muted-foreground">{t('form.noAvailableCatalogs')}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>{t('form.copyFrom')}</Label>
                <Select
                  value={copyFromCouncilId || '__none__'}
                  onValueChange={(value) =>
                    setCopyFromCouncilId(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.copyFromPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('form.copyFromPlaceholder')}</SelectItem>
                    {councils.map((council) => (
                      <SelectItem key={council.id} value={council.id}>
                        {council.code} — {council.catalogName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {renderMemberEditor(memberDrafts, setMemberDrafts, false)}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              disabled={!catalogId || createMutation.isPending}
              onClick={submitCreate}
            >
              {t('form.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className={COUNCIL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>{t('form.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
            {renderMemberEditor(memberDrafts, setMemberDrafts, isReviewStarted)}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button disabled={updateMutation.isPending} onClick={submitUpdate}>
              {t('form.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
