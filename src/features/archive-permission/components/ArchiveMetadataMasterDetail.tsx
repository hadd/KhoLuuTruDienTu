import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ArchiveAclMatrixT,
  ArchiveAclPrincipalT,
  ArchiveMetadataViewDocumentTypeT,
  ArchiveMetadataViewSlotT,
} from '@/features/archive-permission/api/archiveAclClient'
import { ArchiveMetadataViewMatrix } from '@/features/archive-permission/components/ArchiveMetadataViewMatrix'
import { collectMetadataWarnings } from '@/features/archive-permission/lib/archiveAclParentWarnings'
import {
  archiveMetadataViewDocumentTypesQueryOptions,
  archiveMetadataViewMatrixQueryOptions,
  useAssignAllArchiveMetadataView,
  useSaveArchiveMetadataViewMatrix,
} from '@/features/archive-permission/queries'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

function principalKey(p: ArchiveAclPrincipalT) {
  return `${p.kind}:${p.id}`
}

function newSlotCode(): string {
  return `col_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function PrincipalPickerDialog({
  open,
  onOpenChange,
  title,
  draft,
  setDraft,
  catalogUsers,
  catalogRoles,
  saving,
  canSave,
  onSave,
  saveLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  draft: Array<ArchiveAclPrincipalT>
  setDraft: Dispatch<SetStateAction<Array<ArchiveAclPrincipalT>>>
  catalogUsers: Array<{ id: string; name: string }>
  catalogRoles: Array<{ id: string; name: string }>
  saving: boolean
  canSave: boolean
  onSave: () => void
  saveLabel: string
}) {
  const { t } = useTranslation('archive-permission')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (open) setFilter('')
  }, [open])

  function togglePrincipal(p: ArchiveAclPrincipalT) {
    setDraft((list) => {
      const key = principalKey(p)
      if (list.some((x) => principalKey(x) === key)) {
        return list.filter((x) => principalKey(x) !== key)
      }
      return [...list, p]
    })
  }

  const filteredUsers = catalogUsers.filter((u) =>
    u.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )
  const filteredRoles = catalogRoles.filter((r) =>
    r.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('acl.searchPlaceholder')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block">{t('acl.users')}</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
              {filteredUsers.map((u) => {
                const p = { kind: 'user' as const, id: u.id }
                const checked = draft.some((x) => principalKey(x) === principalKey(p))
                return (
                  <label
                    key={u.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm',
                      checked && 'bg-primary/10',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePrincipal(p)}
                    />
                    <span className="truncate">{u.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">{t('acl.roles')}</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
              {filteredRoles.map((r) => {
                const p = { kind: 'role' as const, id: r.id }
                const checked = draft.some((x) => principalKey(x) === principalKey(p))
                return (
                  <label
                    key={r.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm',
                      checked && 'bg-primary/10',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePrincipal(p)}
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('acl.cancel')}
          </Button>
          <Button type="button" disabled={!canSave || saving} onClick={onSave}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ArchiveMetadataMasterDetailProps = {
  matrix: ArchiveAclMatrixT
  catalogUsers: Array<{ id: string; name: string }>
  catalogRoles: Array<{ id: string; name: string }>
}

export function ArchiveMetadataMasterDetail({
  matrix,
  catalogUsers,
  catalogRoles,
}: ArchiveMetadataMasterDetailProps) {
  const { t } = useTranslation('archive-permission')
  const queryClient = useQueryClient()
  const listQuery = useQuery(archiveMetadataViewDocumentTypesQueryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [draftSlots, setDraftSlots] = useState<Array<ArchiveMetadataViewSlotT>>([])
  const [editSlot, setEditSlot] = useState<ArchiveMetadataViewSlotT | null>(null)
  const [editDraft, setEditDraft] = useState<Array<ArchiveAclPrincipalT>>([])
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [addColumnDraft, setAddColumnDraft] = useState<Array<ArchiveAclPrincipalT>>([])

  const documentTypes = listQuery.data ?? []

  const filteredTypes = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return documentTypes
    return documentTypes.filter(
      (item: ArchiveMetadataViewDocumentTypeT) =>
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    )
  }, [documentTypes, filter])

  useEffect(() => {
    if (filteredTypes.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredTypes.some((d) => d.id === selectedId)) {
      setSelectedId(filteredTypes[0]!.id)
    }
  }, [filteredTypes, selectedId])

  const matrixQuery = useQuery({
    ...archiveMetadataViewMatrixQueryOptions(selectedId ?? ''),
    enabled: Boolean(selectedId),
  })

  useEffect(() => {
    if (matrixQuery.data?.slots) {
      setDraftSlots(matrixQuery.data.slots)
    }
  }, [matrixQuery.data?.slots])

  const saveMutation = useSaveArchiveMetadataViewMatrix()
  const assignAllMutation = useAssignAllArchiveMetadataView()

  const nameByPrincipal = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of catalogUsers) map.set(`user:${u.id}`, u.name)
    for (const r of catalogRoles) map.set(`role:${r.id}`, r.name)
    return map
  }, [catalogRoles, catalogUsers])

  const warnings = useMemo(() => {
    if (!selectedId) return []
    const fromDraft = collectMetadataWarnings(
      selectedId,
      draftSlots,
      matrix,
      nameByPrincipal,
    )
    const fromServer = matrixQuery.data?.warnings ?? []
    const codes = new Set(fromDraft.map((w) => w.code))
    return [
      ...fromDraft,
      ...fromServer.filter((w) => !codes.has(w.code)),
    ]
  }, [draftSlots, matrix, matrixQuery.data?.warnings, nameByPrincipal, selectedId])

  function handleSave() {
    if (!selectedId) return
    saveMutation.mutate(
      { documentTypeId: selectedId, slots: draftSlots },
      {
        onSuccess: (data) => {
          setDraftSlots(data.slots)
          if (data.warnings.length > 0) {
            toast.warning(t('acl.parentWarning.savedWithWarnings'))
          } else {
            toast.success(t('acl.metadataView.toastSaved'))
          }
          void queryClient.invalidateQueries({
            queryKey: ['admin', 'archive-acl', 'metadata-view'],
          })
        },
        onError: (error) => toast.error(translateError(error)),
      },
    )
  }

  function handleAssignAll() {
    if (!selectedId || draftSlots.length === 0) return
    const target = draftSlots[0]!
    if (target.principals.length === 0) {
      toast.error(t('acl.metadataView.assignAllNeedsPrincipals'))
      return
    }
    assignAllMutation.mutate(
      {
        documentTypeId: selectedId,
        slotCode: target.slotCode,
        principals: target.principals,
      },
      {
        onSuccess: (data) => {
          setDraftSlots(data.slots)
          toast.success(t('acl.metadataView.toastSaved'))
        },
        onError: (error) => toast.error(translateError(error)),
      },
    )
  }

  const selectedType = documentTypes.find((d) => d.id === selectedId) ?? null
  const isSaving = saveMutation.isPending || assignAllMutation.isPending

  if (listQuery.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Alert>
        <AlertDescription>{t('acl.metadataView.banner')}</AlertDescription>
      </Alert>

      {warnings.length > 0 ? (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertTitle>{t('acl.parentWarning.title')}</AlertTitle>
          <AlertDescription className="space-y-1">
            {warnings.map((w) => (
              <p key={w.code} className="text-sm">
                {w.message}{' '}
                <span className="font-medium">
                  {w.principalNames.slice(0, 3).join(', ')}
                  {w.principalNames.length > 3
                    ? t('acl.parentWarning.andOthers', {
                        count: w.principalNames.length - 3,
                      })
                    : ''}
                </span>
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-[28rem] grid-cols-1 overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(14rem,20rem)_1fr]">
        <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="border-b p-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('acl.metadataView.searchDocumentTypes')}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filteredTypes.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                {t('acl.noMatch')}
              </p>
            ) : (
              <ul>
                {filteredTypes.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-colors',
                        item.id === selectedId
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-muted/60 text-foreground',
                      )}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="truncate text-xs text-muted-foreground">
                          {item.id}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.hasMetadataConfig
                            ? t('acl.metadataView.configured')
                            : t('acl.metadataView.notConfigured')}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-background">
          {selectedType ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {selectedType.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedType.id}
                    {' · '}
                    {selectedType.hasMetadataConfig
                      ? t('acl.metadataView.configured')
                      : t('acl.metadataView.notConfigured')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('acl.metadataView.subtitle')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isSaving || draftSlots.length === 0}
                    onClick={handleAssignAll}
                  >
                    {t('acl.metadataView.assignAll')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving}
                    onClick={handleSave}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t('acl.save')
                    )}
                  </Button>
                </div>
              </div>
              <ArchiveMetadataViewMatrix
                groups={matrixQuery.data?.groups ?? []}
                slots={draftSlots}
                isLoading={matrixQuery.isPending}
                disabled={isSaving}
                nameByPrincipal={nameByPrincipal}
                onSlotsChange={setDraftSlots}
                onEditSlotPrincipals={(slot) => {
                  setEditSlot(slot)
                  setEditDraft(slot.principals)
                }}
                onAddColumn={() => {
                  setAddColumnDraft([])
                  setAddColumnOpen(true)
                }}
                onDeleteSlot={(slot) => {
                  setDraftSlots((prev) =>
                    prev.filter((s) => s.slotCode !== slot.slotCode),
                  )
                }}
              />
            </>
          ) : (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              {t('acl.selectResource')}
            </p>
          )}
        </section>
      </div>

      <PrincipalPickerDialog
        open={Boolean(editSlot)}
        onOpenChange={(open) => {
          if (!open) setEditSlot(null)
        }}
        title={t('acl.editPrincipalsTitle')}
        draft={editDraft}
        setDraft={setEditDraft}
        catalogUsers={catalogUsers}
        catalogRoles={catalogRoles}
        saving={false}
        canSave={Boolean(editSlot)}
        saveLabel={t('acl.save')}
        onSave={() => {
          if (!editSlot) return
          setDraftSlots((prev) =>
            prev.map((s) =>
              s.slotCode === editSlot.slotCode
                ? { ...s, principals: editDraft }
                : s,
            ),
          )
          setEditSlot(null)
        }}
      />

      <PrincipalPickerDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        title={t('acl.metadataView.addColumn')}
        draft={addColumnDraft}
        setDraft={setAddColumnDraft}
        catalogUsers={catalogUsers}
        catalogRoles={catalogRoles}
        saving={false}
        canSave={addColumnDraft.length > 0}
        saveLabel={t('acl.metadataView.addColumn')}
        onSave={() => {
          const slot: ArchiveMetadataViewSlotT = {
            slotCode: newSlotCode(),
            sortOrder: draftSlots.length,
            principals: addColumnDraft,
            fieldKeys: [],
          }
          setDraftSlots((prev) => [...prev, slot])
          setAddColumnOpen(false)
        }}
      />
    </div>
  )
}
