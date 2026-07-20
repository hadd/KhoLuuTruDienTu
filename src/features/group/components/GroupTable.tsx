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

export function GroupTable({ groups, onSelectGroup }: GroupTableProps) {
  const { t } = useTranslation('group')

  return (
    <Table className="w-full min-w-[720px] table-fixed">
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="w-[22%]">{t('table.columns.name')}</TableHead>
          <TableHead className="w-[20%]">{t('table.columns.project')}</TableHead>
          <TableHead className="w-[12%] text-center">
            {t('table.columns.roundNumber')}
          </TableHead>
          <TableHead className="w-[11%] text-center">
            {t('table.columns.memberCount')}
          </TableHead>
          <TableHead className="w-[11%] text-center">
            {t('table.columns.editorCount')}
          </TableHead>
          <TableHead className="w-[11%] text-center">
            {t('table.columns.qcCount')}
          </TableHead>
          <TableHead className="w-[13%]">{t('table.columns.leader')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="h-24 text-center text-muted-foreground"
            >
              {t('noData')}
            </TableCell>
          </TableRow>
        ) : (
          groups.map((group) => (
            <TableRow
              key={group.id}
              className="cursor-pointer"
              onClick={() => onSelectGroup(group.id)}
            >
              <TableCell className="align-top font-medium">{group.name}</TableCell>
              <TableCell className="max-w-0 truncate align-top">
                {group.projectName ?? group.projectCode ?? t('card.project.empty')}
              </TableCell>
              <TableCell className="align-top text-center">
                {group.roundNumber}
              </TableCell>
              <TableCell className="align-top text-center">
                {group.memberCount}
              </TableCell>
              <TableCell className="align-top text-center">
                {group.editorCount}
              </TableCell>
              <TableCell className="align-top text-center">
                {group.qcCount}
              </TableCell>
              <TableCell className="max-w-0 truncate align-top">
                {group.leader?.fullName ?? t('card.empty')}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
