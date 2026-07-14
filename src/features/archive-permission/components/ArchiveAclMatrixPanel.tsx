import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { cn } from '@/lib/utils/cn'

const PERM_LABEL_KEYS: Record<string, string> = {
  'archive.warehouse.search': 'slot.permissions.search',
  'archive.warehouse.read': 'slot.permissions.read',
  'archive.warehouse.manage': 'slot.permissions.manage',
}

function principalKey(p: ArchiveAclPrincipalT) {
  return `${p.kind}:${p.id}`
}

function ResourceAclCard({
  resource,
  catalogUsers,
  catalogRoles,
}: {
  resource: ArchiveAclResourceT
  catalogUsers: Array<{ id: string; name: string }>
  catalogRoles: Array<{ id: string; name: string }>
}) {
  const { t } = useTranslation('archive-permission')
  const setPrincipals = useSetArchiveAclPrincipals()
  const applyAll = useApplyAllArchiveAclPermissions()

  const [editOpen, setEditOpen] = useState(false)
  const [editPermissionKey, setEditPermissionKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Array<ArchiveAclPrincipalT>>([])
  const [filter, setFilter] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyDraft, setApplyDraft] = useState<Array<ArchiveAclPrincipalT>>([])

  const nameByPrincipal = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of catalogUsers) map.set(`user:${u.id}`, u.name)
    for (const r of catalogRoles) map.set(`role:${r.id}`, r.name)
    return map
  }, [catalogRoles, catalogUsers])

  const filteredUsers = catalogUsers.filter((u) =>
    u.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )
  const filteredRoles = catalogRoles.filter((r) =>
    r.name.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  function openEdit(permissionKey: string, principals: Array<ArchiveAclPrincipalT>) {
    setEditPermissionKey(permissionKey)
    setDraft(principals)
    setFilter('')
    setEditOpen(true)
  }

  function togglePrincipal(p: ArchiveAclPrincipalT, list: Array<ArchiveAclPrincipalT>) {
    const key = principalKey(p)
    if (list.some((x) => principalKey(x) === key)) {
      return list.filter((x) => principalKey(x) !== key)
    }
    return [...list, p]
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{resource.name}</p>
          <p className="text-xs text-muted-foreground">{resource.resourceId}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setApplyDraft([])
            setFilter('')
            setApplyOpen(true)
          }}
        >
          {t('acl.applyAll')}
        </Button>
      </div>

      <div className="space-y-2">
        {resource.permissions.map((perm) => (
          <div
            key={perm.permissionKey}
            className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t(PERM_LABEL_KEYS[perm.permissionKey] ?? perm.permissionKey)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {perm.principals.length === 0
                  ? t('acl.noPrincipals')
                  : perm.principals
                      .map(
                        (p) =>
                          `${p.kind === 'role' ? t('acl.role') : t('acl.user')}: ${
                            nameByPrincipal.get(principalKey(p)) ?? p.id
                          }`,
                      )
                      .join(' · ')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openEdit(perm.permissionKey, perm.principals)}
            >
              {t('acl.editPrincipals')}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('acl.editPrincipalsTitle')}</DialogTitle>
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
                        onCheckedChange={() => setDraft((prev) => togglePrincipal(p, prev))}
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
                        onCheckedChange={() => setDraft((prev) => togglePrincipal(p, prev))}
                      />
                      <span className="truncate">{r.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              {t('acl.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!editPermissionKey || setPrincipals.isPending}
              onClick={() => {
                if (!editPermissionKey) return
                setPrincipals.mutate(
                  {
                    resourceKind: resource.resourceKind,
                    resourceId: resource.resourceId,
                    permissionKey: editPermissionKey,
                    principals: draft,
                  },
                  { onSuccess: () => setEditOpen(false) },
                )
              }}
            >
              {setPrincipals.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('acl.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('acl.applyAllTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('acl.applyAllHint')}</p>
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
                  const checked = applyDraft.some((x) => principalKey(x) === principalKey(p))
                  return (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setApplyDraft((prev) => togglePrincipal(p, prev))
                        }
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
                  const checked = applyDraft.some((x) => principalKey(x) === principalKey(p))
                  return (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setApplyDraft((prev) => togglePrincipal(p, prev))
                        }
                      />
                      <span className="truncate">{r.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApplyOpen(false)}>
              {t('acl.cancel')}
            </Button>
            <Button
              type="button"
              disabled={applyDraft.length === 0 || applyAll.isPending}
              onClick={() => {
                applyAll.mutate(
                  {
                    resourceKind: resource.resourceKind as ArchiveAclResourceKindT,
                    resourceId: resource.resourceId,
                    principals: applyDraft,
                  },
                  { onSuccess: () => setApplyOpen(false) },
                )
              }}
            >
              {applyAll.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t('acl.applyAll')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ArchiveAclMatrixPanel() {
  const { t } = useTranslation('archive-permission')
  const matrixQuery = useQuery(archiveAclMatrixQueryOptions())
  const catalogQuery = useQuery(archiveAclCatalogQueryOptions())

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

  const { fonds, dossierTypes, documentTypes } = matrixQuery.data
  const users = catalogQuery.data.users
  const roles = catalogQuery.data.roles

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{t('acl.intro')}</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('acl.sectionFonds')}</h2>
        {fonds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('acl.emptyFonds')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {fonds.map((resource) => (
              <ResourceAclCard
                key={resource.resourceId}
                resource={resource}
                catalogUsers={users}
                catalogRoles={roles}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('acl.sectionDossierTypes')}</h2>
        {dossierTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('acl.emptyDossierTypes')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dossierTypes.map((resource) => (
              <ResourceAclCard
                key={resource.resourceId}
                resource={resource}
                catalogUsers={users}
                catalogRoles={roles}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('acl.sectionDocumentTypes')}</h2>
        {documentTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('acl.emptyDocumentTypes')}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {documentTypes.map((resource) => (
              <ResourceAclCard
                key={resource.resourceId}
                resource={resource}
                catalogUsers={users}
                catalogRoles={roles}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
