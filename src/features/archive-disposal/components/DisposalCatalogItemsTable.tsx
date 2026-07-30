import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type DisposalCatalogItemsTableProps = {
  groups: Array<DisposalCatalogDossierGroupT>
  canEdit: boolean
  reasonDrafts: Record<string, string>
  onReasonDraftChange: (itemId: string, reason: string) => void
  onReasonSave: (itemId: string, reason: string) => void
  onRemoveItem: (itemId: string) => void
  isSavingReason?: boolean
  isRemoving?: boolean
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
}: DisposalCatalogItemsTableProps) {
  const { t } = useTranslation('archive-disposal')
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>{t('proposal.table.dossier')}</TableHead>
          <TableHead>{t('proposal.table.fileName')}</TableHead>
          <TableHead>{t('proposal.table.source')}</TableHead>
          <TableHead>{t('proposal.table.reason')}</TableHead>
          {canEdit ? <TableHead className="w-12" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const hasDocuments = group.documentItems.length > 0
          const isExpanded = expandedDossierIds.has(group.dossierId)

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
                {canEdit ? (
                  <TableCell>
                    {group.dossierItem
                      ? renderRemoveButton(group.dossierItem.id)
                      : null}
                  </TableCell>
                ) : null}
              </TableRow>

              {isExpanded
                ? group.documentItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell />
                      <TableCell
                        className={cn('text-muted-foreground', 'pl-8 text-sm')}
                      >
                        ↳ {group.dossierName}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.fileName ?? item.fileId}
                      </TableCell>
                      <TableCell>{t(`proposal.source.${item.source}`)}</TableCell>
                      <TableCell>{renderReasonCell(item)}</TableCell>
                      {canEdit ? (
                        <TableCell>{renderRemoveButton(item.id)}</TableCell>
                      ) : null}
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
