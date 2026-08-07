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

export type DisposalDocumentPreviewTargetT = {
  dossierId: string
  fileId: string
  fileName: string
}

type CouncilEvaluationConfigT = {
  enabled: boolean
  isMember: boolean
  canViewAllNotes: boolean
  currentUserId: string
  drafts: Record<string, string>
  evaluationsByItemId: Record<
    string,
    Array<{ userId: string; userName: string; note: string }>
  >
  onDraftChange: (itemId: string, note: string) => void
  onSave: (itemId: string) => void
  isSaving?: boolean
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
    if (notes.length === 0) {
      return <span className="text-sm text-muted-foreground">—</span>
    }
    return (
      <ul className="space-y-1 text-sm">
        {notes.map((entry) => (
          <li key={`${entry.userId}-${itemId}`}>
            <span className="font-medium">{entry.userName}:</span> {entry.note}
          </li>
        ))}
      </ul>
    )
  }

  function renderMyEvaluationCell(item: DisposalProposalItemT) {
    if (!councilEvaluation?.isMember) return null
    const draft = councilEvaluation.drafts[item.id] ?? ''
    const saved = councilEvaluation.evaluationsByItemId[item.id]?.find(
      (entry) => entry.userId === councilEvaluation.currentUserId,
    )
    return (
      <div className="flex min-w-[200px] flex-col gap-2">
        <Textarea
          value={draft}
          placeholder={t('proposal.evaluationPlaceholder')}
          rows={2}
          onChange={(event) =>
            councilEvaluation.onDraftChange(item.id, event.target.value)
          }
          disabled={councilEvaluation.isSaving}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={
            councilEvaluation.isSaving || draft.trim().length === 0
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
          if (reason !== item.reason) {
            onReasonSave(item.id, reason)
          }
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
