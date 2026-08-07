import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createDisposalCouncil } from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { DisposalCouncilMemberEditor } from '@/features/archive-disposal-council/components/DisposalCouncilMemberEditor'
import { createDefaultCouncilMemberRows } from '@/features/archive-disposal-council/lib/disposalCouncilMemberDrafts'
import {
  availableCatalogsForCouncilQueryOptions,
  disposalCouncilDetailQueryOptions,
  disposalCouncilsQueryKeyPrefix,
  disposalCouncilsQueryOptions,
} from '@/features/archive-disposal-council/queries'
import type { DisposalCouncilMemberInputT } from '@/features/archive-disposal-council/types'
import { adminUsersQueryOptions } from '@/features/user/queries'
import { translateError } from '@/lib/utils/translate-error'

const COUNCIL_DIALOG_CONTENT_CLASS =
  '!flex max-h-[min(90dvh,900px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'

type DisposalCouncilCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select and optionally lock the catalog selector. */
  initialCatalogId?: string | null
  initialCatalogLabel?: string | null
  lockCatalogSelect?: boolean
  onCreated?: (councilId: string) => void
}

export function DisposalCouncilCreateDialog({
  open,
  onOpenChange,
  initialCatalogId = null,
  initialCatalogLabel = null,
  lockCatalogSelect = false,
  onCreated,
}: DisposalCouncilCreateDialogProps) {
  const { t } = useTranslation('archive-disposal-council')
  const queryClient = useQueryClient()

  const [catalogId, setCatalogId] = useState('')
  const [memberDrafts, setMemberDrafts] = useState<Array<DisposalCouncilMemberInputT>>(
    createDefaultCouncilMemberRows(),
  )
  const [copyFromCouncilId, setCopyFromCouncilId] = useState('')

  const { data: availableCatalogs } = useQuery({
    ...availableCatalogsForCouncilQueryOptions(),
    enabled: open,
  })
  const { data: councilList } = useQuery({
    ...disposalCouncilsQueryOptions({ page: 1, limit: 50 }),
    enabled: open,
  })
  const { data: usersData, isPending: isUsersPending } = useQuery({
    ...adminUsersQueryOptions({ page: 1, limit: 200 }),
    enabled: open,
  })

  const activeUsers = useMemo(
    () => (usersData?.items ?? []).filter((user) => !user.deletedAt),
    [usersData?.items],
  )
  const councils = councilList?.items ?? []

  useEffect(() => {
    if (!open) return
    setCatalogId(initialCatalogId ?? '')
    setMemberDrafts(createDefaultCouncilMemberRows())
    setCopyFromCouncilId('')
  }, [open, initialCatalogId])

  useEffect(() => {
    if (!copyFromCouncilId || !open) return
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
  }, [copyFromCouncilId, open, queryClient])

  const createMutation = useMutation({
    mutationFn: createDisposalCouncil,
    onSuccess: async (result) => {
      toast.success(t('form.save'))
      onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: disposalCouncilsQueryKeyPrefix })
      await queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'available-catalogs-for-council'],
      })
      onCreated?.(result.council.id)
      if (result.warnings?.length) {
        toast.warning(t('warnings.conflictTitle'))
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  function submitCreate() {
    if (!catalogId) return
    createMutation.mutate({
      catalogId,
      members: memberDrafts.filter((member) => member.userId),
      copiedFromCouncilId: copyFromCouncilId || null,
    })
  }

  const catalogOptions = useMemo(() => {
    const items = availableCatalogs?.items ?? []
    if (
      initialCatalogId &&
      !items.some((item) => item.id === initialCatalogId)
    ) {
      return [
        {
          id: initialCatalogId,
          name: initialCatalogLabel ?? initialCatalogId,
          code: '',
          catalogDate: '',
          status: 'SUBMITTED',
        },
        ...items,
      ]
    }
    return items
  }, [availableCatalogs?.items, initialCatalogId, initialCatalogLabel])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={COUNCIL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>{t('form.title')}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('form.catalog')}</Label>
              <Select
                value={catalogId}
                onValueChange={setCatalogId}
                disabled={lockCatalogSelect && Boolean(initialCatalogId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.catalogPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {catalogOptions.map((catalog) => (
                    <SelectItem key={catalog.id} value={catalog.id}>
                      {catalog.name}
                      {catalog.code ? ` (${catalog.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!availableCatalogs?.items.length && !initialCatalogId ? (
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
            <DisposalCouncilMemberEditor
              members={memberDrafts}
              onChange={setMemberDrafts}
              users={activeUsers}
              isUsersLoading={isUsersPending}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button disabled={!catalogId || createMutation.isPending} onClick={submitCreate}>
            {t('form.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
