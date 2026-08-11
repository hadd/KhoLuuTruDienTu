import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DisposalCatalogDossierGroupT } from '@/features/archive-disposal/lib/groupDisposalCatalogItems'
import type { DisposalProposalItemT } from '@/features/archive-disposal/types'
import { cn } from '@/lib/utils/cn'

import type { DisposalCouncilEvaluationDecisionT } from '@/features/archive-disposal-council/types'

export type DisposalDocumentPreviewTargetT = {
  dossierId: string
  fileId: string
  fileName: string
}

type EvaluationDraftT = {
  decision: DisposalCouncilEvaluationDecisionT | null
  reason: string
  changeReason: string
}

type CouncilEvaluationConfigT = {
  enabled: boolean
  isMember: boolean
  canViewAllNotes: boolean
  canChairDecide: boolean
  evaluationsLocked: boolean
  currentUserId: string
  drafts: Record<string, EvaluationDraftT>
  evaluationsByItemId: Record<
    string,
    Array<{
      userId: string
      userName: string
      note: string
      decision: DisposalCouncilEvaluationDecisionT | null
    }>
  >
  outcomesByItemId: Record<
    string,
    {
      concludedDecision: DisposalCouncilEvaluationDecisionT | null
      needsChairDecision: boolean
      hasDissent: boolean
      destroyVoteCount: number
      keepVoteCount: number
    }
  >
  onDraftChange: (itemId: string, patch: Partial<EvaluationDraftT>) => void
  onSave: (itemId: string) => void
  onChairDecide?: (itemId: string) => void
  isSaving?: boolean
}

function decisionShortLabel(
  decision: DisposalCouncilEvaluationDecisionT | null,
  t: (key: string) => string,
): string {
  if (decision === 'DESTROY') return t('proposal.evaluationDecisionDestroy')
  if (decision === 'KEEP') return t('proposal.evaluationDecisionKeep')
  return '—'
}

type DisposalCatalogItemsTableProps = {
  groups: Array<DisposalCatalogDossierGroupT>
  canEdit: boolean
  reasonDrafts: Record<string, string>
  onReasonDraftChange: (itemId: string, reason: string) => void
  onReasonSave: (itemId: string, reason: string) => void
  onRemoveItem: (itemId: string) => void
  isSavingReason?: boolean
  isRemoving?: boolean
  councilEvaluation?: CouncilEvaluationConfigT
  onPreviewDocument?: (target: DisposalDocumentPreviewTargetT) => void
}

export function DisposalCatalogItemsTable({
  groups,
  canEdit,
  reasonDrafts,
  onReasonDraftChange,
  onReasonSave,
  onRemoveItem,
  isSavingReason = false,
  isRemoving = false,
  councilEvaluation,
  onPreviewDocument,
}: DisposalCatalogItemsTableProps) {
  const { t } = useTranslation('archive-disposal')
  const showCouncilEval = Boolean(councilEvaluation?.enabled)
  const showMyEvalColumn = showCouncilEval && Boolean(councilEvaluation?.isMember)
  const showCouncilNotesColumn =
    showCouncilEval && Boolean(councilEvaluation?.canViewAllNotes)
  const [expandedDossierIds, setExpandedDossierIds] = useState<Set<string>>(
    () => new Set(),
  )

  function toggleExpanded(dossierId: string) {
    setExpandedDossierIds((prev) => {
      const next = new Set(prev)
      if (next.has(dossierId)) next.delete(dossierId)
      else next.add(dossierId)
      return next
    })
  }

  function renderCouncilNotesCell(itemId: string) {
    if (!councilEvaluation?.canViewAllNotes) return null
    const notes = councilEvaluation.evaluationsByItemId[itemId] ?? []
    const outcome = councilEvaluation.outcomesByItemId[itemId]
    return (
      <div className="space-y-2 text-sm">
        {outcome ? (
          <p className="font-medium">
            {t('proposal.councilOutcome')}:{' '}
            {decisionShortLabel(outcome.concludedDecision, t)}
            {outcome.needsChairDecision
              ? ` (${t('proposal.awaitingChair')})`
              : null}
            {outcome.hasDissent ? ` (${t('proposal.hasDissent')})` : null}
            <span className="ml-1 font-normal text-muted-foreground">
              ({outcome.destroyVoteCount}/{outcome.keepVoteCount})
            </span>
          </p>
        ) : null}
        {notes.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-1">
            {notes.map((entry) => (
              <li key={`${entry.userId}-${itemId}`}>
                <span className="font-medium">{entry.userName}:</span>{' '}
                {decisionShortLabel(entry.decision, t)} — {entry.note}
              </li>
            ))}
          </ul>
        )}
        {outcome?.needsChairDecision && councilEvaluation.canChairDecide ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={councilEvaluation.isSaving}
            onClick={() => councilEvaluation.onChairDecide?.(itemId)}
          >
            {t('proposal.chairDecide')}
          </Button>
        ) : null}
      </div>
    )
  }

  function renderMyEvaluationCell(item: DisposalProposalItemT) {
    if (!councilEvaluation?.isMember) return null
    const draft = councilEvaluation.drafts[item.id] ?? {
      decision: null,
      reason: '',
      changeReason: '',
    }
    const saved = councilEvaluation.evaluationsByItemId[item.id]?.find(
      (entry) => entry.userId === councilEvaluation.currentUserId,
    )
    const locked = councilEvaluation.evaluationsLocked
    return (
      <div className="flex min-w-[220px] flex-col gap-2">
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`eval-decision-${item.id}`}
              checked={draft.decision === 'DESTROY'}
              disabled={locked || councilEvaluation.isSaving}
              onChange={() =>
                councilEvaluation.onDraftChange(item.id, { decision: 'DESTROY' })
              }
            />
            {t('proposal.evaluationDecisionDestroy')}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name={`eval-decision-${item.id}`}
              checked={draft.decision === 'KEEP'}
              disabled={locked || councilEvaluation.isSaving}
              onChange={() =>
                councilEvaluation.onDraftChange(item.id, { decision: 'KEEP' })
              }
            />
            {t('proposal.evaluationDecisionKeep')}
          </label>
        </div>
        <Textarea
          value={draft.reason}
          placeholder={t('proposal.evaluationReasonPlaceholder')}
          rows={2}
          onChange={(event) =>
            councilEvaluation.onDraftChange(item.id, { reason: event.target.value })
          }
          disabled={locked || councilEvaluation.isSaving}
        />
        {saved ? (
          <Input
            value={draft.changeReason}
            placeholder={t('proposal.evaluationChangeReasonPlaceholder')}
            onChange={(event) =>
              councilEvaluation.onDraftChange(item.id, {
                changeReason: event.target.value,
              })
            }
            disabled={locked || councilEvaluation.isSaving}
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            locked ||
            councilEvaluation.isSaving ||
            !draft.decision ||
            draft.reason.trim().length === 0
          }
          onClick={() => councilEvaluation.onSave(item.id)}
        >
          {saved ? t('proposal.evaluationUpdate') : t('proposal.evaluationSave')}
        </Button>
      </div>
    )
  }

  function renderReasonCell(item: DisposalProposalItemT) {
    if (!canEdit) {
      return item.reason || '—'
    }

    return (
      <Input
        value={reasonDrafts[item.id] ?? ''}
        placeholder={t('proposal.reasonPlaceholder')}
        onChange={(event) => onReasonDraftChange(item.id, event.target.value)}
        onBlur={() => {
          const reason = reasonDrafts[item.id]?.trim() ?? ''
          if (reason === item.reason.trim()) return
          if (!reason) {
            onReasonDraftChange(item.id, item.reason)
            onReasonSave(item.id, reason)
            return
          }
          onReasonSave(item.id, reason)
        }}
        disabled={isSavingReason}
      />
    )
  }

  function renderRemoveButton(itemId: string) {
    if (!canEdit) return null
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled={isRemoving}
        onClick={() => onRemoveItem(itemId)}
        aria-label={t('proposal.removeItem')}
      >
        <Trash2 className="size-4" />
      </Button>
    )
  }

  function renderFileNameCell(
    dossierId: string,
    fileId: string,
    fileName: string,
    referenceOnly: boolean,
  ) {
    if (!onPreviewDocument) {
      return <span className="font-medium">{fileName}</span>
    }
    return (
      <Button
        type="button"
        variant="link"
        className={cn(
          'h-auto p-0 font-medium',
          referenceOnly && 'text-muted-foreground',
        )}
        onClick={() =>
          onPreviewDocument({ dossierId, fileId, fileName })
        }
      >
        {fileName}
      </Button>
    )
  }

  function renderEvalCellsForItem(
    group: DisposalCatalogDossierGroupT,
    item: DisposalProposalItemT,
  ) {
    const showEval =
      group.evaluationScope === 'DOCUMENT' ||
      (group.evaluationScope === 'DOSSIER' && item.fileId == null)

    if (!showEval) {
      return {
        myEval: <span className="text-sm text-muted-foreground">—</span>,
        councilNotes: <span className="text-sm text-muted-foreground">—</span>,
      }
    }

    return {
      myEval: renderMyEvaluationCell(item),
      councilNotes: renderCouncilNotesCell(item.id),
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>{t('proposal.table.dossier')}</TableHead>
          <TableHead>{t('proposal.table.fileName')}</TableHead>
          <TableHead>{t('proposal.table.source')}</TableHead>
          <TableHead>{t('proposal.table.reason')}</TableHead>
          {showMyEvalColumn ? (
            <TableHead>{t('proposal.table.myEvaluation')}</TableHead>
          ) : null}
          {showCouncilNotesColumn ? (
            <TableHead>{t('proposal.table.councilEvaluations')}</TableHead>
          ) : null}
          {canEdit ? <TableHead className="w-12" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const hasDocuments =
            group.documentItems.length > 0 ||
            group.referenceDocuments.length > 0
          const isExpanded = expandedDossierIds.has(group.dossierId)
          const dossierEvalCells = group.dossierItem
            ? renderEvalCellsForItem(group, group.dossierItem)
            : null

          return (
            <Fragment key={group.dossierId}>
              <TableRow className="bg-muted/20">
                <TableCell>
                  {hasDocuments ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => toggleExpanded(group.dossierId)}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? t('proposal.collapseDocuments')
                          : t('proposal.expandDocuments')
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                  ) : null}
                </TableCell>
                <TableCell className="font-medium">{group.dossierName}</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>
                  {group.dossierItem
                    ? t(`proposal.source.${group.dossierItem.source}`)
                    : '—'}
                </TableCell>
                <TableCell>
                  {group.dossierItem ? renderReasonCell(group.dossierItem) : '—'}
                </TableCell>
                {showMyEvalColumn ? (
                  <TableCell>
                    {dossierEvalCells?.myEval ?? '—'}
                  </TableCell>
                ) : null}
                {showCouncilNotesColumn ? (
                  <TableCell>
                    {dossierEvalCells?.councilNotes ?? '—'}
                  </TableCell>
                ) : null}
                {canEdit ? (
                  <TableCell>
                    {group.dossierItem
                      ? renderRemoveButton(group.dossierItem.id)
                      : null}
                  </TableCell>
                ) : null}
              </TableRow>

              {isExpanded
                ? group.documentItems.map((item) => {
                    const evalCells = renderEvalCellsForItem(group, item)
                    return (
                      <TableRow key={item.id}>
                        <TableCell />
                        <TableCell
                          className={cn('text-muted-foreground', 'pl-8 text-sm')}
                        >
                          ↳ {group.dossierName}
                        </TableCell>
                        <TableCell>
                          {renderFileNameCell(
                            group.dossierId,
                            item.fileId!,
                            item.fileName ?? item.fileId!,
                            false,
                          )}
                        </TableCell>
                        <TableCell>{t(`proposal.source.${item.source}`)}</TableCell>
                        <TableCell>
                          {group.evaluationScope === 'DOCUMENT'
                            ? renderReasonCell(item)
                            : '—'}
                        </TableCell>
                        {showMyEvalColumn ? (
                          <TableCell>{evalCells.myEval}</TableCell>
                        ) : null}
                        {showCouncilNotesColumn ? (
                          <TableCell>{evalCells.councilNotes}</TableCell>
                        ) : null}
                        {canEdit ? (
                          <TableCell>
                            {group.evaluationScope === 'DOCUMENT'
                              ? renderRemoveButton(item.id)
                              : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                : null}

              {isExpanded
                ? group.referenceDocuments.map((ref) => (
                    <TableRow key={`ref-${ref.fileId}`} className="bg-muted/5">
                      <TableCell />
                      <TableCell
                        className={cn('text-muted-foreground', 'pl-8 text-sm')}
                      >
                        ↳ {group.dossierName}
                      </TableCell>
                      <TableCell>
                        {renderFileNameCell(
                          group.dossierId,
                          ref.fileId,
                          ref.fileName,
                          true,
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {t('proposal.referenceDocument')}
                      </TableCell>
                      <TableCell>—</TableCell>
                      {showMyEvalColumn ? (
                        <TableCell>
                          <span className="text-sm text-muted-foreground">—</span>
                        </TableCell>
                      ) : null}
                      {showCouncilNotesColumn ? (
                        <TableCell>
                          <span className="text-sm text-muted-foreground">—</span>
                        </TableCell>
                      ) : null}
                      {canEdit ? <TableCell /> : null}
                    </TableRow>
                  ))
                : null}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function DisposalCatalogItemsTablePending() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}
