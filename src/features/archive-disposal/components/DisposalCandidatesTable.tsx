import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState, useMemo, type ReactNode } from 'react'
import { DisposalDocumentPreviewPanel } from '@/features/archive-disposal/components/DisposalDocumentPreviewPanel'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  DisposalCandidateGroupT,
  DisposalCandidateItemT,
} from '@/features/archive-disposal/types'
import { canSelectItemFond } from '@/features/archive-disposal/lib/disposalCatalogFondSelection'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

// Color palette for distinct duplicate groups (cycles if > 5 groups)
const GROUP_COLORS = [
  { row: 'bg-amber-50/60 dark:bg-amber-950/25', border: 'border-b-2 border-amber-300 dark:border-amber-700' },
  { row: 'bg-sky-50/60 dark:bg-sky-950/25',    border: 'border-b-2 border-sky-300 dark:border-sky-700' },
  { row: 'bg-violet-50/60 dark:bg-violet-950/25', border: 'border-b-2 border-violet-300 dark:border-violet-700' },
  { row: 'bg-emerald-50/60 dark:bg-emerald-950/25', border: 'border-b-2 border-emerald-300 dark:border-emerald-700' },
  { row: 'bg-rose-50/60 dark:bg-rose-950/25',  border: 'border-b-2 border-rose-300 dark:border-rose-700' },
]

export type DisposalCandidateToggleContextT = {
  dossierId: string
  kind: 'dossier' | 'document'
}

type DisposalCandidatesTableProps = {
  groups: Array<DisposalCandidateGroupT>
  selectedKeys: Set<string>
  onToggleAll: (checked: boolean, keys: Array<string>) => void
  onToggleOne: (
    key: string,
    checked: boolean,
    context: DisposalCandidateToggleContextT,
  ) => void
  itemKey: (item: DisposalCandidateItemT) => string
  renderCategoryBadges: (item: DisposalCandidateItemT) => ReactNode
  dateLocale: 'en' | 'vi'
  lockedFondId?: string | null
  lockedFondId?: string | null
  selectionAnchorFondId?: string | null
  councilReviewEnabled?: boolean
}

export function DisposalCandidatesTable({
  groups,
  selectedKeys,
  onToggleAll,
  onToggleOne,
  itemKey,
  renderCategoryBadges,
  dateLocale,
  lockedFondId,
  selectionAnchorFondId,
  councilReviewEnabled = true,
}: DisposalCandidatesTableProps) {
  const { t } = useTranslation('archive-disposal')
  const [expandedDossierIds, setExpandedDossierIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [previewTarget, setPreviewTarget] = useState<{
    dossierId: string
    fileId: string
    fileName: string
  } | null>(null)

  const visualBlocks = useMemo(() => {
    const blocks: Array<{ duplicateGroupId: string | null; groups: typeof groups }> = []
    const dupMap = new Map<string, typeof groups>()

    for (const group of groups) {
      const dupId = group.dossierItem?.duplicateGroupId || group.documentItems.find(d => d.duplicateGroupId)?.duplicateGroupId
      if (dupId) {
        if (!dupMap.has(dupId)) dupMap.set(dupId, [])
        dupMap.get(dupId)!.push(group)
      } else {
        blocks.push({ duplicateGroupId: null, groups: [group] })
      }
    }

    const dupBlocks = Array.from(dupMap.entries()).map(([duplicateGroupId, g]) => ({
      duplicateGroupId,
      groups: g,
    }))
    return [...dupBlocks, ...blocks]
  }, [groups])

  const dossierSelectableKeys = useMemo(() => {
    return visualBlocks.flatMap(block => {
      const isDuplicateGroup = block.duplicateGroupId !== null
      return block.groups.flatMap((group, indexInBlock) => {
        if (isDuplicateGroup && indexInBlock === block.groups.length - 1) return []
        if (
          group.dossierItem &&
          (!councilReviewEnabled ||
            canSelectItemFond(
              group.dossierItem.fondId,
              selectionAnchorFondId ?? null,
              lockedFondId,
            ))
        ) {
          return [itemKey(group.dossierItem)]
        }
        return []
      })
    })
  }, [visualBlocks, selectionAnchorFondId, lockedFondId, itemKey, councilReviewEnabled])

  const selectedDossierCount = dossierSelectableKeys.filter((key) =>
    selectedKeys.has(key),
  ).length
  const allDossiersSelected =
    dossierSelectableKeys.length > 0 &&
    selectedDossierCount === dossierSelectableKeys.length
  const someSelected =
    selectedKeys.size > 0 &&
    (!allDossiersSelected || selectedKeys.size > selectedDossierCount)

  function toggleExpanded(dossierId: string) {
    setExpandedDossierIds((prev) => {
      const next = new Set(prev)
      if (next.has(dossierId)) next.delete(dossierId)
      else next.add(dossierId)
      return next
    })
  }

  function renderExpiresAt(value: string | null) {
    return value ? formatDate(value, 'P', dateLocale) : '—'
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={
                allDossiersSelected
                  ? true
                  : someSelected
                    ? 'indeterminate'
                    : false
              }
              onCheckedChange={(checked) =>
                onToggleAll(checked === true, dossierSelectableKeys)
              }
              aria-label={t('disposal.selectAllDossiers')}
            />
          </TableHead>
          <TableHead className="w-10" />
          <TableHead>{t('disposal.table.dossierName')}</TableHead>
          <TableHead>{t('disposal.table.fileName')}</TableHead>
          <TableHead>{t('disposal.table.fond')}</TableHead>
          <TableHead>{t('disposal.table.retention')}</TableHead>
          <TableHead>{t('disposal.table.expiresAt')}</TableHead>
          <TableHead>{t('disposal.table.category')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(() => {
          // Assign sequential index only to duplicate groups for alternating colors
          let dupGroupColorIndex = -1
          return visualBlocks.map((block, blockIndex) => {
          const isDuplicateGroup = block.duplicateGroupId !== null
          if (isDuplicateGroup) dupGroupColorIndex++
          const colorIndex = isDuplicateGroup ? dupGroupColorIndex % GROUP_COLORS.length : -1
          return (
            <Fragment key={block.duplicateGroupId ?? `block-${blockIndex}`}>
              {block.groups.map((group, indexInBlock) => {
                const hasDocuments = group.documentItems.length > 0
                const isExpanded = expandedDossierIds.has(group.dossierId)
                const dossierItem = group.dossierItem
                const isLastInDuplicateGroup =
                  isDuplicateGroup && indexInBlock === block.groups.length - 1

                const colorDef = colorIndex >= 0 ? GROUP_COLORS[colorIndex] : null
                const bgClass = cn(
                  'bg-muted/20',
                  colorDef?.row,
                  isLastInDuplicateGroup && colorDef?.border
                )

                return (
                  <Fragment key={group.dossierId}>
                    <TableRow className={bgClass}>
                      <TableCell>
                  {dossierItem ? (() => {
                    const canSelect = !councilReviewEnabled || canSelectItemFond(
                      dossierItem.fondId,
                      selectionAnchorFondId ?? null,
                      lockedFondId,
                    )
                    const noFond = !dossierItem.fondId?.trim()
                    const wrongFond = !noFond && !canSelect
                    const disabledReason = !councilReviewEnabled 
                      ? null 
                      : noFond
                        ? 'Hồ sơ chưa được gán phông — không thể thêm vào đề xuất hủy'
                        : wrongFond
                          ? 'Chỉ được chọn hồ sơ cùng phông trong một đề xuất hủy'
                          : null
                    const checkbox = (
                      <Checkbox
                        checked={selectedKeys.has(itemKey(dossierItem))}
                        disabled={!canSelect}
                        onCheckedChange={(checked) =>
                          onToggleOne(itemKey(dossierItem), checked === true, {
                            dossierId: group.dossierId,
                            kind: 'dossier',
                          })
                        }
                        aria-label={group.dossierName}
                      />
                    )
                    if (disabledReason) {
                      return (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-not-allowed">{checkbox}</span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-56 text-xs">
                              {disabledReason}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    }
                    return checkbox
                  })() : null}
                </TableCell>
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
                <TableCell className="font-medium">
                  <div>
                    {group.dossierName}
                    {dossierItem?.duplicateCriteria?.length > 0 && (
                       <div className="text-xs text-muted-foreground mt-1">
                         Trùng lặp: {dossierItem.duplicateCriteria.map(c => 
                           c === 'DOSSIER_NAME' ? 'Tên hồ sơ' :
                           c === 'DOSSIER_CODE' ? 'Mã hồ sơ' :
                           c === 'FILE_NAME_STRICT' ? 'Tên tài liệu' :
                           c === 'DOCUMENT_METADATA_SIMILARITY' ? 'Nội dung/trích yếu' : c
                         ).join(', ')}
                       </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>{group.fondName ?? '—'}</TableCell>
                <TableCell>{group.retentionPeriodName ?? '—'}</TableCell>
                <TableCell>{renderExpiresAt(group.expiresAt)}</TableCell>
                <TableCell>
                  {dossierItem ? renderCategoryBadges(dossierItem) : '—'}
                </TableCell>
              </TableRow>

              {isExpanded
                ? group.documentItems.map((item) => (
                    <TableRow key={itemKey(item)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys.has(itemKey(item))}
                          disabled={
                            councilReviewEnabled &&
                            !canSelectItemFond(
                              item.fondId,
                              selectionAnchorFondId ?? null,
                              lockedFondId,
                            )
                          }
                          onCheckedChange={(checked) =>
                            onToggleOne(itemKey(item), checked === true, {
                              dossierId: group.dossierId,
                              kind: 'document',
                            })
                          }
                          aria-label={item.fileName ?? group.dossierName}
                        />
                      </TableCell>
                      <TableCell />
                      <TableCell
                        className={cn('text-muted-foreground', 'pl-8 text-sm')}
                      >
                        ↳ {group.dossierName}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.fileName && item.fileId ? (
                           <div>
                             <button 
                               type="button" 
                               className="text-primary hover:underline text-left" 
                               onClick={() => setPreviewTarget({ dossierId: item.dossierId, fileId: item.fileId!, fileName: item.fileName! })}
                             >
                               {item.fileName}
                             </button>
                             {item.duplicateCriteria?.length > 0 && (
                               <div className="text-xs text-muted-foreground mt-1">
                                 Trùng lặp: {item.duplicateCriteria.map(c => 
                                   c === 'DOSSIER_NAME' ? 'Tên hồ sơ' :
                                   c === 'DOSSIER_CODE' ? 'Mã hồ sơ' :
                                   c === 'FILE_NAME_STRICT' ? 'Tên tài liệu' :
                                   c === 'DOCUMENT_METADATA_SIMILARITY' ? 'Nội dung/trích yếu' : c
                                 ).join(', ')}
                               </div>
                             )}
                           </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{item.fondName ?? '—'}</TableCell>
                      <TableCell>{item.retentionPeriodName ?? '—'}</TableCell>
                      <TableCell>{renderExpiresAt(item.expiresAt)}</TableCell>
                      <TableCell>{renderCategoryBadges(item)}</TableCell>
                    </TableRow>
                  ))
                : null}
            </Fragment>
          )
        })}
          </Fragment>
          )
        })
        })()} 
      </TableBody>
    </Table>
    {previewTarget ? (
      <DisposalDocumentPreviewPanel
        target={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />
    ) : null}
    </>
  )
}
