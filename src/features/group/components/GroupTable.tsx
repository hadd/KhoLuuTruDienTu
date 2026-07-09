import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GroupListItem } from '@/features/group/types'

interface GroupTableProps {
  groups: Array<GroupListItem>
  onSelectGroup: (groupId: string) => void
}

export function GroupTable({
  groups,
  onSelectGroup,
}: GroupTableProps) {
  const { t } = useTranslation('group')

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground">
        {t('noData')}
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-border bg-muted/60 hover:bg-muted/60">
            <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.name')}
            </TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.project')}
            </TableHead>
            <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.roundNumber')}
            </TableHead>
            <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.memberCount')}
            </TableHead>
            <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.editorCount')}
            </TableHead>
            <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.qcCount')}
            </TableHead>
            <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('table.columns.leader')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
              <TableRow
                key={group.id}
                className="cursor-pointer bg-card hover:bg-muted/40"
                onClick={() => onSelectGroup(group.id)}
              >
                <TableCell className="px-4 py-3 font-medium">{group.name}</TableCell>
                <TableCell className="max-w-[200px] truncate px-4 py-3">
                  {group.projectName ?? group.projectCode ?? t('card.project.empty')}
                </TableCell>
                <TableCell className="px-4 py-3 text-center">{group.roundNumber}</TableCell>
                <TableCell className="px-4 py-3 text-center">{group.memberCount}</TableCell>
                <TableCell className="px-4 py-3 text-center">{group.editorCount}</TableCell>
                <TableCell className="px-4 py-3 text-center">{group.qcCount}</TableCell>
                <TableCell className="max-w-[180px] truncate px-4 py-3">
                  {group.leader?.fullName ?? t('card.empty')}
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
