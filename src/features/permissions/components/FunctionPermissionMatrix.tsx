import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Minus } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isGrantKeyGranted } from '@/features/permissions/api/permissionClient'
import { useUpdatePermissionGrant } from '@/features/permissions/queries'
import type {
  PermissionGrantT,
  PermissionRoleT,
  SystemFunctionCodeT,
  SystemFunctionT,
} from '@/features/permissions/types'
import { cn } from '@/lib/utils/cn'

interface FunctionPermissionMatrixProps {
  roles: PermissionRoleT[]
  functions: SystemFunctionT[]
  grants: PermissionGrantT[]
  searchQuery?: string
}

function isLockedGrant(
  role: PermissionRoleT,
  fn: SystemFunctionT,
  granted: boolean,
): boolean {
  return (
    role.code === 'admin' &&
    fn.code === 'permission_management' &&
    granted
  )
}

export function FunctionPermissionMatrix({
  roles,
  functions,
  grants,
  searchQuery = '',
}: FunctionPermissionMatrixProps) {
  const { t } = useTranslation('permissions')
  const updateGrant = useUpdatePermissionGrant()
  const [pendingCell, setPendingCell] = useState<string | null>(null)

  const filteredFunctions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return functions

    return functions.filter((fn) => {
      const label = t(`functions.${fn.code}`).toLowerCase()
      const description = t(`functionsDescription.${fn.code}`).toLowerCase()
      return label.includes(q) || description.includes(q) || fn.code.includes(q)
    })
  }, [functions, searchQuery, t])

  const handleToggle = (
    role: PermissionRoleT,
    fn: SystemFunctionT,
    currentlyGranted: boolean,
  ) => {
    if (isLockedGrant(role, fn, currentlyGranted)) return

    const cellKey = `${role.id}:${fn.id}`
    setPendingCell(cellKey)

    updateGrant.mutate(
      {
        roleId: role.id,
        functionId: fn.id,
        granted: !currentlyGranted,
      },
      {
        onSettled: () => setPendingCell(null),
      },
    )
  }

  if (filteredFunctions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-md border border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        {t('matrix.emptyFunctions')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow>
              <TableHead className="sticky left-0 z-30 min-w-[140px] bg-card">
                {t('matrix.columns.role')}
              </TableHead>
              {filteredFunctions.map((fn) => (
                <TableHead
                  key={fn.id}
                  className="min-w-[120px] max-w-[160px] text-center"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="line-clamp-2 cursor-default text-xs font-medium">
                        {t(`functions.${fn.code as SystemFunctionCodeT}`)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium">
                        {t(`functions.${fn.code as SystemFunctionCodeT}`)}
                      </p>
                      <p className="text-muted-foreground">
                        {t(`functionsDescription.${fn.code as SystemFunctionCodeT}`)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {t(`roles.${role.code}`)}
                </TableCell>
                {filteredFunctions.map((fn) => {
                  const granted = isGrantKeyGranted(grants, role.id, fn.id)
                  const locked = isLockedGrant(role, fn, granted)
                  const cellKey = `${role.id}:${fn.id}`
                  const isPending = pendingCell === cellKey

                  return (
                    <TableCell key={fn.id} className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={granted}
                          disabled={locked || isPending}
                          onCheckedChange={() =>
                            handleToggle(role, fn, granted)
                          }
                          aria-label={t('matrix.toggleGrant', {
                            role: t(`roles.${role.code}`),
                            function: t(`functions.${fn.code as SystemFunctionCodeT}`),
                          })}
                          className={cn(locked && 'opacity-60')}
                          title={
                            locked
                              ? t('matrix.lockedAdminPermission')
                              : undefined
                          }
                        />
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function PermissionMatrixLegend() {
  const { t } = useTranslation('permissions')

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Check className="size-4 text-foreground" />
        {t('matrix.legend.granted')}
      </span>
      <span className="flex items-center gap-1.5">
        <Minus className="size-4" />
        {t('matrix.legend.denied')}
      </span>
    </div>
  )
}
