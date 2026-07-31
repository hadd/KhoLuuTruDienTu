import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

type DisposalCandidatesTableProps = {
  groups: Array<DisposalCandidateGroupT>
  selectedKeys: Set<string>
  onToggleAll: (checked: boolean, keys: Array<string>) => void
  onToggleOne: (key: string, checked: boolean) => void
  itemKey: (item: DisposalCandidateItemT) => string
  renderCategoryBadges: (item: DisposalCandidateItemT) => ReactNode
  dateLocale: 'en' | 'vi'
}

export function DisposalCandidatesTable({
  groups,
  selectedKeys,
  onToggleAll,
  onToggleOne,
  itemKey,
  renderCategoryBadges,
  dateLocale,
}: DisposalCandidatesTableProps) {
  const { t } = useTranslation('archive-disposal')
  const [expandedDossierIds, setExpandedDossierIds] = useState<Set<string>>(
    () => new Set(),
  )

  const selectableKeys = groups.flatMap((group) => {
    const keys: Array<string> = []
    if (group.dossierItem) keys.push(itemKey(group.dossierItem))
    group.documentItems.forEach((item) => keys.push(itemKey(item)))
    return keys
  })

  const selectedCount = selectableKeys.filter((key) => selectedKeys.has(key)).length
  const allSelected =
    selectableKeys.length > 0 && selectedCount === selectableKeys.length
  const someSelected = selectedCount > 0 && selectedCount < selectableKeys.length

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={
                allSelected ? true : someSelected ? 'indeterminate' : false
              }
              onCheckedChange={(checked) =>
                onToggleAll(checked === true, selectableKeys)
              }
              aria-label={t('disposal.selectAll')}
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
        {groups.map((group) => {
          const hasDocuments = group.documentItems.length > 0
          const isExpanded = expandedDossierIds.has(group.dossierId)
          const dossierItem = group.dossierItem

          return (
            <Fragment key={group.dossierId}>
              <TableRow className="bg-muted/20">
                <TableCell>
                  {dossierItem ? (
                    <Checkbox
                      checked={selectedKeys.has(itemKey(dossierItem))}
                      onCheckedChange={(checked) =>
                        onToggleOne(itemKey(dossierItem), checked === true)
                      }
                      aria-label={group.dossierName}
                    />
                  ) : null}
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
                <TableCell className="font-medium">{group.dossierName}</TableCell>
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
                          onCheckedChange={(checked) =>
                            onToggleOne(itemKey(item), checked === true)
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
                        {item.fileName ?? '—'}
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
      </TableBody>
    </Table>
  )
}
