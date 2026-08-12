import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataConfigSectionTabs } from '@/features/data-config/components/DataConfigSectionTabs'
import {
  borrowApprovalClearanceQueryOptions,
  useReplaceBorrowApprovalClearances,
} from '@/features/borrow-approval-clearance/queries'
import type { BorrowApprovalClearanceDraftRowT } from '@/features/borrow-approval-clearance/types'

function newDraftKey(): string {
  return `draft-${crypto.randomUUID()}`
}

function rowsFromData(
  items: Array<{
    id: string
    roleId: string
    maxSecurityLevelId: string
  }>,
): Array<BorrowApprovalClearanceDraftRowT> {
  return items.map((item) => ({
    key: item.id,
    roleId: item.roleId,
    maxSecurityLevelId: item.maxSecurityLevelId,
  }))
}

export function BorrowApprovalClearancePage() {
  const { t } = useTranslation('borrow-approval-clearance')
  const { data, isLoading, isError, error, refetch } = useQuery(
    borrowApprovalClearanceQueryOptions(),
  )
  const replaceMutation = useReplaceBorrowApprovalClearances()

  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState<Array<BorrowApprovalClearanceDraftRowT>>([])

  useEffect(() => {
    if (!data || isEditing) return
    setRows(rowsFromData(data.items))
  }, [data, isEditing])

  const usedRoleIds = useMemo(
    () => new Set(rows.map((row) => row.roleId).filter(Boolean)),
    [rows],
  )

  const availableRolesForAdd = useMemo(() => {
    if (!data) return []
    return data.roles.filter((role) => !usedRoleIds.has(role.id))
  }, [data, usedRoleIds])

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const role of data?.roles ?? []) {
      map.set(role.id, role.name)
    }
    for (const item of data?.items ?? []) {
      map.set(item.roleId, item.roleName)
    }
    return map
  }, [data])

  const levelLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const level of data?.securityLevels ?? []) {
      map.set(level.id, `${level.levelOrder}. ${level.name}`)
    }
    for (const item of data?.items ?? []) {
      map.set(
        item.maxSecurityLevelId,
        `${item.maxLevelOrder}. ${item.maxSecurityLevelName}`,
      )
    }
    return map
  }, [data])

  const canSave =
    rows.every((row) => row.roleId && row.maxSecurityLevelId) &&
    new Set(rows.map((r) => r.roleId)).size === rows.length

  const handleStartEdit = () => {
    if (data) {
      setRows(rowsFromData(data.items))
    }
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (data) {
      setRows(rowsFromData(data.items))
    }
    setIsEditing(false)
  }

  const handleAdd = () => {
    if (!isEditing) return
    const firstRole = availableRolesForAdd[0]
    const firstLevel = data?.securityLevels[0]
    if (!firstRole || !firstLevel) return
    setRows((prev) => [
      ...prev,
      {
        key: newDraftKey(),
        roleId: firstRole.id,
        maxSecurityLevelId: firstLevel.id,
      },
    ])
  }

  const handleRemove = (key: string) => {
    if (!isEditing) return
    setRows((prev) => prev.filter((row) => row.key !== key))
  }

  const handleSave = () => {
    if (!isEditing || !canSave) return
    replaceMutation.mutate(
      {
        items: rows.map((row) => ({
          roleId: row.roleId,
          maxSecurityLevelId: row.maxSecurityLevelId,
        })),
      },
      {
        onSuccess: () => {
          setIsEditing(false)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t('loading')}</div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : t('errors.loadFailed')}
        </p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {t('actions.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DataConfigSectionTabs active="borrow-approval-clearance" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={availableRolesForAdd.length === 0}
                onClick={handleAdd}
              >
                <Plus className="size-4" />
                {t('actions.add')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={replaceMutation.isPending}
                onClick={handleCancelEdit}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSave || replaceMutation.isPending}
                onClick={handleSave}
              >
                {replaceMutation.isPending
                  ? t('actions.saving')
                  : t('actions.save')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
            >
              <Pencil className="size-4" />
              {t('actions.edit')}
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('empty')}
          {isEditing ? null : (
            <div className="mt-3">
              <Button type="button" size="sm" onClick={handleStartEdit}>
                <Pencil className="size-4" />
                {t('actions.edit')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.role')}</TableHead>
                <TableHead>{t('columns.maxLevel')}</TableHead>
                {isEditing ? (
                  <TableHead className="w-[80px]">{t('columns.actions')}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const roleOptions = data.roles.filter(
                  (role) =>
                    role.id === row.roleId || !usedRoleIds.has(role.id),
                )
                return (
                  <TableRow key={row.key}>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={row.roleId}
                          onValueChange={(value) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? { ...r, roleId: value }
                                  : r,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="min-w-[12rem]">
                            <SelectValue
                              placeholder={t('placeholders.role')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {roleNameById.get(row.roleId) ?? row.roleId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={row.maxSecurityLevelId}
                          onValueChange={(value) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? { ...r, maxSecurityLevelId: value }
                                  : r,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="min-w-[12rem]">
                            <SelectValue
                              placeholder={t('placeholders.level')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {data.securityLevels.map((level) => (
                              <SelectItem key={level.id} value={level.id}>
                                {level.levelOrder}. {level.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {levelLabelById.get(row.maxSecurityLevelId) ??
                            row.maxSecurityLevelId}
                        </span>
                      )}
                    </TableCell>
                    {isEditing ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('actions.remove')}
                          onClick={() => handleRemove(row.key)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
