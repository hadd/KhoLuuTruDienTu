import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArchiveFondMultiSelect } from '@/features/archive-permission/components/ArchiveFondMultiSelect'
import {
  activeArchiveFondsQueryOptions,
  archivePermissionConfigQueryOptions,
  archiveUserAssignmentsQueryOptions,
  readyArchivePermissionConfigOptionsQueryOptions,
  useReplaceArchiveUserAssignments,
} from '@/features/archive-permission/queries'
import type { ArchivePermissionSlotT } from '@/features/archive-permission/types'
import { adminUsersQueryOptions } from '@/features/user/queries'

type DraftAssignmentRowT = {
  key: string
  configId: string
  slotCode: string
  fondIds: Array<string>
}

function createEmptyRow(): DraftAssignmentRowT {
  return {
    key: crypto.randomUUID(),
    configId: '',
    slotCode: '',
    fondIds: [],
  }
}

export function DirectUserAssignmentPanel() {
  const { t } = useTranslation('archive-permission')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [rows, setRows] = useState<Array<DraftAssignmentRowT>>([])

  const { data: usersData, isLoading: isLoadingUsers } = useQuery(
    adminUsersQueryOptions({ page: 1, limit: 200 }),
  )
  const { data: configOptionsData, isLoading: isLoadingConfigs } = useQuery(
    readyArchivePermissionConfigOptionsQueryOptions(),
  )
  const { data: fondsData, isLoading: isLoadingFonds } = useQuery(
    activeArchiveFondsQueryOptions(),
  )
  const { data: assignmentsData, isLoading: isLoadingAssignments } = useQuery(
    archiveUserAssignmentsQueryOptions(selectedUserId ?? ''),
  )

  const replaceMutation = useReplaceArchiveUserAssignments()

  const users = usersData?.items ?? []
  const fonds = fondsData?.items ?? []
  const configOptions = configOptionsData?.items ?? []

  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase()
    if (!normalized) return users
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized),
    )
  }, [userSearch, users])

  useEffect(() => {
    if (!selectedUserId) {
      setRows([])
      return
    }

    const items = assignmentsData?.items ?? []
    setRows(
      items.length > 0
        ? items.map((item) => ({
            key: item.id,
            configId: item.configId,
            slotCode: item.slotCode,
            fondIds: item.fondIds,
          }))
        : [],
    )
  }, [assignmentsData?.items, selectedUserId])

  const handleSave = () => {
    if (!selectedUserId) return

    const assignments = rows
      .filter((row) => row.configId && row.slotCode)
      .map((row) => ({
        configId: row.configId,
        slotCode: row.slotCode,
        fondIds: row.fondIds,
      }))

    replaceMutation.mutate({
      userId: selectedUserId,
      payload: { assignments },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">{t('directAssign.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('directAssign.description')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <Label>{t('directAssign.selectUser')}</Label>
          <Input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder={t('directAssign.userPlaceholder')}
          />
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t('directAssign.userPlaceholder')}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const selected = selectedUserId === user.id
                return (
                  <button
                    key={user.id}
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent ${
                      selected ? 'bg-accent/70' : ''
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <span className="font-medium">{user.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          {!selectedUserId ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t('directAssign.emptyUser')}
            </p>
          ) : isLoadingAssignments ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  {t('directAssign.assignmentsTitle')}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRows((prev) => [...prev, createEmptyRow()])}
                  >
                    <Plus className="size-4" />
                    {t('directAssign.addRow')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={replaceMutation.isPending}
                    onClick={handleSave}
                  >
                    {replaceMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {t('directAssign.save')}
                  </Button>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  {t('directAssign.noAssignments')}
                </p>
              ) : (
                <div className="space-y-3 overflow-y-auto">
                  {rows.map((row, index) => (
                    <AssignmentRowEditor
                      key={row.key}
                      row={row}
                      configOptions={configOptions}
                      fonds={fonds}
                      fondsLoading={isLoadingFonds}
                      configsLoading={isLoadingConfigs}
                      onChange={(nextRow) => {
                        setRows((prev) => {
                          const next = [...prev]
                          next[index] = nextRow
                          return next
                        })
                      }}
                      onRemove={() => {
                        setRows((prev) =>
                          prev.filter((item) => item.key !== row.key),
                        )
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AssignmentRowEditor({
  row,
  configOptions,
  fonds,
  fondsLoading,
  configsLoading,
  onChange,
  onRemove,
}: {
  row: DraftAssignmentRowT
  configOptions: Array<{ id: string; name: string }>
  fonds: Array<import('@/features/archive-fond/types').ArchiveFondT>
  fondsLoading?: boolean
  configsLoading?: boolean
  onChange: (row: DraftAssignmentRowT) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('archive-permission')
  const { data: configDetail } = useQuery(
    archivePermissionConfigQueryOptions(row.configId),
  )

  const slots: Array<ArchivePermissionSlotT> = configDetail?.slots ?? []

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('directAssign.config')}
            </Label>
            <Select
              value={row.configId || undefined}
              onValueChange={(configId) =>
                onChange({ ...row, configId, slotCode: '' })
              }
              disabled={configsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('directAssign.config')} />
              </SelectTrigger>
              <SelectContent>
                {configOptions.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('directAssign.slot')}
            </Label>
            <Select
              value={row.slotCode || undefined}
              onValueChange={(slotCode) => onChange({ ...row, slotCode })}
              disabled={!row.configId || slots.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('directAssign.defaultSlot')} />
              </SelectTrigger>
              <SelectContent>
                {slots.map((slot) => (
                  <SelectItem key={slot.slotCode} value={slot.slotCode}>
                    {slot.slotName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t('directAssign.fonds')}
        </Label>
        <ArchiveFondMultiSelect
          fonds={fonds}
          isLoading={fondsLoading}
          value={row.fondIds}
          onValueChange={(fondIds) => onChange({ ...row, fondIds })}
        />
      </div>
    </div>
  )
}
