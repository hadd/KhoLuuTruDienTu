import { useQuery } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
  archiveGroupBindingQueryOptions,
  archivePermissionConfigQueryOptions,
  readyArchivePermissionConfigOptionsQueryOptions,
  useSetGroupMemberArchiveSlot,
  useUpsertArchiveGroupBinding,
} from '@/features/archive-permission/queries'
import type { Group } from '@/features/group/types'

interface GroupArchiveBindingEditorProps {
  group: Group
}

export function GroupArchiveBindingEditor({
  group,
}: GroupArchiveBindingEditorProps) {
  const { t } = useTranslation('archive-permission')
  const [configId, setConfigId] = useState('')
  const [fondIds, setFondIds] = useState<Array<string>>([])

  const { data: bindingData, isLoading: isLoadingBinding } = useQuery(
    archiveGroupBindingQueryOptions(group.id),
  )
  const { data: configOptionsData, isLoading: isLoadingOptions } = useQuery(
    readyArchivePermissionConfigOptionsQueryOptions(),
  )
  const { data: configDetail, isLoading: isLoadingConfig } = useQuery(
    archivePermissionConfigQueryOptions(configId),
  )
  const { data: fondsData, isLoading: isLoadingFonds } = useQuery(
    activeArchiveFondsQueryOptions(),
  )

  const upsertBinding = useUpsertArchiveGroupBinding()
  const setMemberSlot = useSetGroupMemberArchiveSlot()

  const binding = bindingData?.record
  const fonds = fondsData?.items ?? []
  const slots = configDetail?.slots ?? []
  const configOptions = configOptionsData?.items ?? []

  const editors = useMemo(
    () => group.members.filter((member) => member.role === 'member'),
    [group.members],
  )

  useEffect(() => {
    if (binding) {
      setConfigId(binding.configId)
      setFondIds(binding.fondIds ?? [])
      return
    }
    setConfigId('')
    setFondIds([])
  }, [binding])

  const hasBindingChanges =
    Boolean(binding) &&
    (binding?.configId !== configId ||
      JSON.stringify(binding?.fondIds ?? []) !== JSON.stringify(fondIds))

  const hasBindingDraft = !binding && Boolean(configId)

  const handleSaveBinding = () => {
    if (!configId) return
    upsertBinding.mutate({
      groupId: group.id,
      payload: { configId, fondIds },
    })
  }

  const handleMemberSlotChange = (
    memberId: string,
    archivePermissionSlotCode: string | null,
  ) => {
    setMemberSlot.mutate({
      groupId: group.id,
      memberId,
      archivePermissionSlotCode,
    })
  }

  if (isLoadingBinding) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('groupAssign.configLabel')}
          </Label>
          <Select
            value={configId || undefined}
            onValueChange={setConfigId}
            disabled={isLoadingOptions}
          >
            <SelectTrigger className="h-9">
              <SelectValue
                placeholder={t('groupAssign.configPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {configOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('groupAssign.fondsLabel')}
          </Label>
          <ArchiveFondMultiSelect
            fonds={fonds}
            isLoading={isLoadingFonds}
            value={fondIds}
            disabled={!configId}
            placeholder={t('groupAssign.fondsPlaceholder')}
            onValueChange={setFondIds}
          />
        </div>

        <div className="flex md:pt-[1.375rem]">
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={
              !configId ||
              upsertBinding.isPending ||
              (!hasBindingChanges && !hasBindingDraft)
            }
            onClick={handleSaveBinding}
          >
            {upsertBinding.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t('groupAssign.save')}
          </Button>
        </div>
      </div>

      {configId ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('groupAssign.membersHint')}
          </p>
          {isLoadingConfig ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : editors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('groupAssign.noEditors')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('groupAssign.columns.name')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('groupAssign.columns.role')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('groupAssign.columns.slot')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editors.map((member) => (
                    <tr key={member.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.email}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t('groupAssign.editorRole')}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={
                            member.archivePermissionSlotCode ?? '__default__'
                          }
                          onValueChange={(value) =>
                            handleMemberSlotChange(
                              member.id,
                              value === '__default__' ? null : value,
                            )
                          }
                          disabled={setMemberSlot.isPending || slots.length === 0}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">
                              {t('groupAssign.defaultSlot')}
                            </SelectItem>
                            {slots.map((slot) => (
                              <SelectItem
                                key={slot.slotCode}
                                value={slot.slotCode}
                              >
                                {slot.slotName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
