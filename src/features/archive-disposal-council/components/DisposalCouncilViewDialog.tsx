import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateDisposalCouncilMembers, setDisposalCouncilMemberAbsent } from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { DisposalCouncilMemberEditor } from '@/features/archive-disposal-council/components/DisposalCouncilMemberEditor'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { mergeCouncilPickerUsers } from '@/features/archive-disposal-council/lib/disposalCouncilEligibleUsers'
import {
  disposalCouncilDetailQueryOptions,
  disposalCouncilEligibleUsersQueryOptions,
  disposalCouncilHistoryQueryOptions,
  disposalCouncilsQueryKeyPrefix,
} from '@/features/archive-disposal-council/queries'
import type { DisposalCouncilMemberInputT } from '@/features/archive-disposal-council/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const COUNCIL_DIALOG_CONTENT_CLASS =
  '!flex max-h-[min(90dvh,900px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'

type DisposalCouncilViewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  councilId: string | null
}

export function DisposalCouncilViewDialog({
  open,
  onOpenChange,
  councilId,
}: DisposalCouncilViewDialogProps) {
  const { t } = useTranslation('archive-disposal-council')
  const language = useCurrentLanguage()
  const queryClient = useQueryClient()
  const { canUpdateCouncil } = useDisposalCouncilAccess()

  const [editOpen, setEditOpen] = useState(false)
  const [memberDrafts, setMemberDrafts] = useState<Array<DisposalCouncilMemberInputT>>([])
  const [changeReason, setChangeReason] = useState('')

  const { data: councilDetail, isPending: isDetailPending } = useQuery({
    ...disposalCouncilDetailQueryOptions(councilId),
    enabled: open && Boolean(councilId),
  })
  const { data: councilHistory } = useQuery({
    ...disposalCouncilHistoryQueryOptions(councilId),
    enabled: open && Boolean(councilId),
  })
  const { data: eligibleUsers, isPending: isUsersPending } = useQuery({
    ...disposalCouncilEligibleUsersQueryOptions(),
    enabled: editOpen,
  })

  const pickerUsers = useMemo(
    () =>
      mergeCouncilPickerUsers(
        eligibleUsers ?? [],
        memberDrafts,
        councilDetail?.members,
      ),
    [eligibleUsers, memberDrafts, councilDetail?.members],
  )

  const isCouncilLocked = Boolean(councilDetail?.council.reviewResult)
  const isReviewStarted = Boolean(councilDetail?.council.reviewStartedAt)
  const canEditMembers = canUpdateCouncil && !isCouncilLocked
  const canMarkAbsent =
    canUpdateCouncil &&
    councilDetail?.council.catalogStatus === 'PENDING_SUBMIT' &&
    !councilDetail?.council.decisionPublishedAt

  const [absentDraftUserId, setAbsentDraftUserId] = useState<string | null>(null)
  const [absentReasonDraft, setAbsentReasonDraft] = useState('')

  const absentMutation = useMutation({
    mutationFn: (input: {
      userId: string
      excusedAbsent: boolean
      absentReason?: string
    }) =>
      setDisposalCouncilMemberAbsent(councilId!, input.userId, {
        excusedAbsent: input.excusedAbsent,
        absentReason: input.absentReason,
      }),
    onSuccess: async () => {
      toast.success(t('absence.updated'))
      setAbsentDraftUserId(null)
      setAbsentReasonDraft('')
      if (councilId) {
        await queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council', councilId],
        })
        await queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council-evaluations', councilId],
        })
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  useEffect(() => {
    if (!open) {
      setEditOpen(false)
      setChangeReason('')
    }
  }, [open])

  const updateMutation = useMutation({
    mutationFn: (input: { members: Array<DisposalCouncilMemberInputT>; reason?: string }) =>
      updateDisposalCouncilMembers(councilId!, input),
    onSuccess: async (result) => {
      toast.success(t('form.save'))
      setEditOpen(false)
      setChangeReason('')
      await queryClient.invalidateQueries({ queryKey: disposalCouncilsQueryKeyPrefix })
      if (councilId) {
        await queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council', councilId],
        })
        await queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council-history', councilId],
        })
      }
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

  return (
    <>
      <Dialog open={open && !editOpen} onOpenChange={onOpenChange}>
        <DialogContent className={COUNCIL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
            {!councilId ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t('list.empty')}
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
                          <th className="px-3 py-2">{t('absence.column')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {councilDetail.members.map((member) => (
                          <tr key={member.id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{member.fullName}</div>
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </td>
                            <td className="px-3 py-2">
                              {member.positionRole}
                            </td>
                            <td className="px-3 py-2">
                              {t(`roles.representation.${member.representationType}`)}
                            </td>
                            <td className="px-3 py-2">
                              {member.excusedAbsent ? (
                                <div className="text-xs">
                                  <div className="font-medium text-amber-800 dark:text-amber-200">
                                    {t('absence.excused')}
                                  </div>
                                  {member.absentReason ? (
                                    <div className="text-muted-foreground">{member.absentReason}</div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                              {canMarkAbsent ? (
                                <div className="mt-1">
                                  {absentDraftUserId === member.userId ? (
                                    <div className="flex flex-col gap-1">
                                      <Input
                                        value={absentReasonDraft}
                                        placeholder={t('absence.reasonPlaceholder')}
                                        onChange={(event) =>
                                          setAbsentReasonDraft(event.target.value)
                                        }
                                      />
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={absentMutation.isPending}
                                          onClick={() => {
                                            setAbsentDraftUserId(null)
                                            setAbsentReasonDraft('')
                                          }}
                                        >
                                          {t('form.cancel')}
                                        </Button>
                                        <Button
                                          size="sm"
                                          disabled={
                                            absentMutation.isPending ||
                                            absentReasonDraft.trim().length === 0
                                          }
                                          onClick={() =>
                                            absentMutation.mutate({
                                              userId: member.userId,
                                              excusedAbsent: true,
                                              absentReason: absentReasonDraft.trim(),
                                            })
                                          }
                                        >
                                          {t('absence.mark')}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="link"
                                      className="h-auto p-0"
                                      onClick={() => {
                                        if (member.excusedAbsent) {
                                          absentMutation.mutate({
                                            userId: member.userId,
                                            excusedAbsent: false,
                                          })
                                        } else {
                                          setAbsentDraftUserId(member.userId)
                                          setAbsentReasonDraft(member.absentReason)
                                        }
                                      }}
                                    >
                                      {member.excusedAbsent
                                        ? t('absence.clear')
                                        : t('absence.mark')}
                                    </Button>
                                  )}
                                </div>
                              ) : null}
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
                            <div className="mt-1 text-xs">
                              {t('history.reason', { reason: item.reason })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t('list.empty')}
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('form.cancel')}
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
            {(eligibleUsers?.length ?? 0) === 0 && !isUsersPending ? (
              <Alert className="mb-3">
                <AlertDescription>{t('form.noEligibleCouncilMembers')}</AlertDescription>
              </Alert>
            ) : null}
            <p className="mb-3 text-xs text-muted-foreground">
              {t('form.memberUserEligibleHint')}
            </p>
            <DisposalCouncilMemberEditor
              members={memberDrafts}
              onChange={setMemberDrafts}
              users={pickerUsers}
              isUsersLoading={isUsersPending}
              showReason={isReviewStarted}
              changeReason={changeReason}
              onChangeReason={setChangeReason}
            />
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  members: memberDrafts.filter((member) => member.userId),
                  reason: changeReason || undefined,
                })
              }
            >
              {t('form.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
