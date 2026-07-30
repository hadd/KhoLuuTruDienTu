import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus, Shield, UserRound, X } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  ArchiveAclPrincipalT,
  ArchiveAclResourceKindT,
  ArchiveAclResourceT,
} from '@/features/archive-permission/api/archiveAclClient'
import {
  archiveAclCatalogQueryOptions,
  archiveAclMatrixQueryOptions,
  useApplyAllArchiveAclPermissions,
  useSetArchiveAclPrincipals,
} from '@/features/archive-permission/queries'
import { ArchiveMetadataMasterDetail } from '@/features/archive-permission/components/ArchiveMetadataMasterDetail'
import { collectResourceWarnings } from '@/features/archive-permission/lib/archiveAclParentWarnings'
import type { ArchiveAclMatrixT } from '@/features/archive-permission/api/archiveAclClient'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

const PERM_LABEL_KEYS: Record<string, string> = {
  'archive.warehouse.read': 'acl.permissions.read',
  'archive.warehouse.edit': 'acl.permissions.edit',
  'archive.warehouse.configure_security': 'acl.permissions.configureSecurity',
  'archive.warehouse.delete': 'acl.permissions.delete',
  'archive.warehouse.reupload': 'acl.permissions.reupload',
}

const VISIBLE_CHIP_LIMIT = 6

type MainTab = 'fond' | 'dossier' | 'document' | 'metadata'
type FondMode = 'fond_type' | 'fond'

function principalKey(p: ArchiveAclPrincipalT) {
  return `${p.kind}:${p.id}`
}

function resourceKey(resource: ArchiveAclResourceT) {
  return `${resource.resourceKind}:${resource.resourceId}`
}

function PrincipalChips({
  principals,
  nameByPrincipal,
}: {
  principals: Array<ArchiveAclPrincipalT>
  nameByPrincipal: Map<string, string>
}) {
  const { t } = useTranslation('archive-permission')

  if (principals.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">{t('acl.noPrincipals')}</span>
    )
  }

  const roles = principals.filter((p) => p.kind === 'role')
  const users = principals.filter((p) => p.kind === 'user')
  const ordered = [...roles, ...users]
  const visible = ordered.slice(0, VISIBLE_CHIP_LIMIT)
  const hiddenCount = ordered.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((p) => {
        const name = nameByPrincipal.get(principalKey(p)) ?? p.id
        return (
          <Tooltip key={principalKey(p)}>
            <TooltipTrigger asChild>
              <Badge
                variant={p.kind === 'role' ? 'secondary' : 'outline'}
                className="max-w-[10rem] gap-1 truncate font-normal"
              >
                {p.kind === 'role' ? (
                  <Shield className="size-3 shrink-0" aria-hidden />
                ) : (
                  <UserRound className="size-3 shrink-0" aria-hidden />
                )}
                {name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">
                {p.kind === 'role' ? t('acl.role') : t('acl.user')}: {name}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      })}
      {hiddenCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 items-center rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t('acl.morePrincipals', { count: hiddenCount })}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-medium">
                {t('acl.allPrincipals', { count: ordered.length })}
              </p>
            </div>
            <div className="max-h-56 space-y-3 overflow-y-auto p-3">
              {roles.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('acl.roles')} ({roles.length})
                  </p>
                  <ul className="space-y-1">
                    {roles.map((p) => (
                      <li
                        key={principalKey(p)}
                        className="truncate rounded-md bg-muted/50 px-2 py-1 text-sm"
                      >
                        {nameByPrincipal.get(principalKey(p)) ?? p.id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {users.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('acl.users')} ({users.length})
                  </p>
                  <ul className="space-y-1">
                    {users.map((p) => (
                      <li
                        key={principalKey(p)}
                        className="truncate rounded-md bg-muted/50 px-2 py-1 text-sm"
                      >
                        {nameByPrincipal.get(principalKey(p)) ?? p.id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function ClearKindButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          <X className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function PrincipalPickerDialog({
  open,
  onOpenChange,
  title,
  hint,
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
  hint?: string
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

  const filteredUsers = catalogUsers.filter((u) =>
    u.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )
  const filteredRoles = catalogRoles.filter((r) =>
    r.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  function togglePrincipal(p: ArchiveAclPrincipalT) {
    setDraft((list) => {
      const key = principalKey(p)
      if (list.some((x) => principalKey(x) === key)) {
        return list.filter((x) => principalKey(x) !== key)
      }
      return [...list, p]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('acl.searchPlaceholder')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="block">{t('acl.users')}</Label>
              <ClearKindButton
                label={t('acl.clearUsers')}
                disabled={!draft.some((p) => p.kind === 'user')}
                onClick={() =>
                  setDraft((prev) => prev.filter((p) => p.kind !== 'user'))
                }
              />
            </div>
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="block">{t('acl.roles')}</Label>
              <ClearKindButton
                label={t('acl.clearRoles')}
                disabled={!draft.some((p) => p.kind === 'role')}
                onClick={() =>
                  setDraft((prev) => prev.filter((p) => p.kind !== 'role'))
                }
              />
            </div>
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

function ResourcePermissionPane({
  resource,
  catalogUsers,
  catalogRoles,
  aclMatrix,
}: {
  resource: ArchiveAclResourceT
  catalogUsers: Array<{ id: string; name: string }>
  catalogRoles: Array<{ id: string; name: string }>
  aclMatrix: ArchiveAclMatrixT
}) {
  const { t } = useTranslation('archive-permission')
  const setPrincipals = useSetArchiveAclPrincipals()
  const applyAll = useApplyAllArchiveAclPermissions()

  const [editOpen, setEditOpen] = useState(false)
  const [editPermissionKey, setEditPermissionKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Array<ArchiveAclPrincipalT>>([])
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyDraft, setApplyDraft] = useState<Array<ArchiveAclPrincipalT>>([])

  const nameByPrincipal = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of catalogUsers) map.set(`user:${u.id}`, u.name)
    for (const r of catalogRoles) map.set(`role:${r.id}`, r.name)
    return map
  }, [catalogRoles, catalogUsers])

  const warnings = useMemo(
    () => collectResourceWarnings(resource, aclMatrix, nameByPrincipal),
    [aclMatrix, nameByPrincipal, resource],
  )

  function openEdit(permissionKey: string, principals: Array<ArchiveAclPrincipalT>) {
    setEditPermissionKey(permissionKey)
    setDraft(principals)
    setEditOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {warnings.length > 0 ? (
        <Alert className="mx-4 mt-3 border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">
            {resource.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{resource.resourceId}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setApplyDraft([])
            setApplyOpen(true)
          }}
        >
          {t('acl.applyAll')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-0 overflow-y-auto">
        {resource.permissions.map((perm) => (
          <div
            key={perm.permissionKey}
            className="border-b px-4 py-3 last:border-b-0"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {t('acl.permissionPrefix', {
                  name: t(PERM_LABEL_KEYS[perm.permissionKey] ?? perm.permissionKey),
                })}
              </p>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                aria-label={t('acl.addPrincipals')}
                onClick={() => openEdit(perm.permissionKey, perm.principals)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <PrincipalChips
              principals={perm.principals}
              nameByPrincipal={nameByPrincipal}
            />
          </div>
        ))}
      </div>

      <PrincipalPickerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t('acl.editPrincipalsTitle')}
        draft={draft}
        setDraft={setDraft}
        catalogUsers={catalogUsers}
        catalogRoles={catalogRoles}
        saving={setPrincipals.isPending}
        canSave={Boolean(editPermissionKey)}
        saveLabel={t('acl.save')}
        onSave={() => {
          if (!editPermissionKey) return
          setPrincipals.mutate(
            {
              resourceKind: resource.resourceKind,
              resourceId: resource.resourceId,
              permissionKey: editPermissionKey,
              principals: draft,
            },
            {
              onSuccess: () => {
                setEditOpen(false)
                const nextResource = {
                  ...resource,
                  permissions: resource.permissions.map((p) =>
                    p.permissionKey === editPermissionKey
                      ? { ...p, principals: draft }
                      : p,
                  ),
                }
                const nextWarnings = collectResourceWarnings(
                  nextResource,
                  aclMatrix,
                  nameByPrincipal,
                )
                if (nextWarnings.length > 0) {
                  toast.warning(t('acl.parentWarning.savedWithWarnings'))
                }
              },
            },
          )
        }}
      />

      <PrincipalPickerDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={t('acl.applyAllTitle')}
        hint={t('acl.applyAllHint')}
        draft={applyDraft}
        setDraft={setApplyDraft}
        catalogUsers={catalogUsers}
        catalogRoles={catalogRoles}
        saving={applyAll.isPending}
        canSave={applyDraft.length > 0}
        saveLabel={t('acl.applyAll')}
        onSave={() => {
          applyAll.mutate(
            {
              resourceKind: resource.resourceKind as ArchiveAclResourceKindT,
              resourceId: resource.resourceId,
              principals: applyDraft,
            },
            {
              onSuccess: () => {
                setApplyOpen(false)
                const nextWarnings = collectResourceWarnings(
                  {
                    ...resource,
                    permissions: resource.permissions.map((p) => ({
                      ...p,
                      principals: [
                        ...p.principals,
                        ...applyDraft.filter(
                          (a) =>
                            !p.principals.some(
                              (x) => principalKey(x) === principalKey(a),
                            ),
                        ),
                      ],
                    })),
                  },
                  aclMatrix,
                  nameByPrincipal,
                )
                if (nextWarnings.length > 0) {
                  toast.warning(t('acl.parentWarning.savedWithWarnings'))
                }
              },
            },
          )
        }}
      />
    </div>
  )
}

function ResourceMasterDetail({
  resources,
  emptyLabel,
  searchPlaceholder,
  catalogUsers,
  catalogRoles,
  aclMatrix,
}: {
  resources: Array<ArchiveAclResourceT>
  emptyLabel: string
  searchPlaceholder?: string
  catalogUsers: Array<{ id: string; name: string }>
  catalogRoles: Array<{ id: string; name: string }>
  aclMatrix: ArchiveAclMatrixT
}) {
  const { t } = useTranslation('archive-permission')
  const [filter, setFilter] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return resources
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.resourceId.toLowerCase().includes(q),
    )
  }, [filter, resources])

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey(null)
      return
    }
    if (!selectedKey || !filtered.some((r) => resourceKey(r) === selectedKey)) {
      setSelectedKey(resourceKey(filtered[0]!))
    }
  }, [filtered, selectedKey])

  const selected = filtered.find((r) => resourceKey(r) === selectedKey) ?? null

  if (resources.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">{emptyLabel}</p>
    )
  }

  return (
    <div className="grid min-h-[28rem] grid-cols-1 overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(14rem,20rem)_1fr]">
      <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
        {searchPlaceholder ? (
          <div className="border-b p-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              {t('acl.noMatch')}
            </p>
          ) : (
            <ul className="p-1">
              {filtered.map((resource) => {
                const key = resourceKey(resource)
                const active = key === selectedKey
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-muted/60 text-foreground',
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <span className="w-full truncate text-sm font-medium">
                        {resource.name}
                      </span>
                      <span className="w-full truncate text-xs text-muted-foreground">
                        {resource.resourceId}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="min-h-0 min-w-0 bg-background">
        {selected ? (
          <ResourcePermissionPane
            resource={selected}
            catalogUsers={catalogUsers}
            catalogRoles={catalogRoles}
            aclMatrix={aclMatrix}
          />
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            {t('acl.selectResource')}
          </p>
        )}
      </section>
    </div>
  )
}

export function ArchiveAclMatrixPanel() {
  const { t } = useTranslation('archive-permission')
  const matrixQuery = useQuery(archiveAclMatrixQueryOptions())
  const catalogQuery = useQuery(archiveAclCatalogQueryOptions())
  const [mainTab, setMainTab] = useState<MainTab>('fond')
  const [fondMode, setFondMode] = useState<FondMode>('fond_type')

  if (matrixQuery.isPending || catalogQuery.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (matrixQuery.isError || catalogQuery.isError || !matrixQuery.data || !catalogQuery.data) {
    return (
      <p className="text-sm text-destructive">{t('acl.loadFailed')}</p>
    )
  }

  const { fondTypes = [], fonds, dossierTypes, documentTypes } = matrixQuery.data
  const users = catalogQuery.data.users
  const roles = catalogQuery.data.roles

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as MainTab)}
          className="space-y-3"
        >
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="fond"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t('acl.tabFond')}
            </TabsTrigger>
            <TabsTrigger
              value="dossier"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t('acl.tabDossier')}
            </TabsTrigger>
            <TabsTrigger
              value="document"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t('acl.tabDocument')}
            </TabsTrigger>
            <TabsTrigger
              value="metadata"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t('acl.tabMetadata')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fond" className="mt-0 space-y-3">
            <div className="inline-flex rounded-lg border p-1">
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  fondMode === 'fond_type'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFondMode('fond_type')}
              >
                {t('acl.modeFondType')}
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  fondMode === 'fond'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFondMode('fond')}
              >
                {t('acl.modeFond')}
              </button>
            </div>

            {fondMode === 'fond_type' ? (
              <ResourceMasterDetail
                resources={fondTypes}
                emptyLabel={t('acl.emptyFondTypes')}
                catalogUsers={users}
                catalogRoles={roles}
                aclMatrix={matrixQuery.data}
              />
            ) : (
              <ResourceMasterDetail
                resources={fonds}
                emptyLabel={t('acl.emptyFonds')}
                searchPlaceholder={t('acl.searchFondsPlaceholder')}
                catalogUsers={users}
                catalogRoles={roles}
                aclMatrix={matrixQuery.data}
              />
            )}
          </TabsContent>

          <TabsContent value="dossier" className="mt-0">
            <ResourceMasterDetail
              resources={dossierTypes}
              emptyLabel={t('acl.emptyDossierTypes')}
              catalogUsers={users}
              catalogRoles={roles}
              aclMatrix={matrixQuery.data}
            />
          </TabsContent>

          <TabsContent value="document" className="mt-0">
            <ResourceMasterDetail
              resources={documentTypes}
              emptyLabel={t('acl.emptyDocumentTypes')}
              catalogUsers={users}
              catalogRoles={roles}
              aclMatrix={matrixQuery.data}
            />
          </TabsContent>

          <TabsContent value="metadata" className="mt-0">
            <ArchiveMetadataMasterDetail
              matrix={matrixQuery.data}
              catalogUsers={users}
              catalogRoles={roles}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
