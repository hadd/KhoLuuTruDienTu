 import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Plus, Search, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataConfigBackNav } from '@/features/data-config/components/DataConfigBackNav'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { rolePermissionsQueryOptions } from '@/features/permissions/queries'
import { WatermarkPlacementDeleteDialog } from '@/features/watermark-config/components/WatermarkPlacementDeleteDialog'
import { WatermarkPlacementEditor } from '@/features/watermark-config/components/WatermarkPlacementEditor'
import { watermarkPlacementsQueryOptions } from '@/features/watermark-config/queries'
import { WATERMARK_POSITION_VALUES } from '@/features/watermark-config/schemas'
import type { WatermarkPlacementSummaryT } from '@/features/watermark-config/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'

const routeApi = getRouteApi('/app/data-config/watermark-configs')

function getPositionLabel(
  t: (key: string) => string,
  position: string,
): string {
  if ((WATERMARK_POSITION_VALUES as ReadonlyArray<string>).includes(position)) {
    return t(`positions.${position}`)
  }
  return position
}

export function WatermarkConfigPage() {
  const { t } = useTranslation('watermark-config')
  const language = useCurrentLanguage()
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const [deletingPlacement, setDeletingPlacement] =
    React.useState<WatermarkPlacementSummaryT | null>(null)

  const { data: profile } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(profile)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })
  const permissions = React.useMemo(
    () =>
      resolvePermissionsForUser(profile, rolePermissions?.rules.permissions),
    [profile, rolePermissions?.rules.permissions],
  )
  const canCreate = isPermissionGranted(
    permissions,
    'watermark.config.create',
    'watermark',
  )
  const canUpdate = isPermissionGranted(
    permissions,
    'watermark.config.update',
    'watermark',
  )
  const canDelete = isPermissionGranted(
    permissions,
    'watermark.config.delete',
    'watermark',
  )

  const placementsQuery = useQuery(watermarkPlacementsQueryOptions())
  const placements = placementsQuery.data ?? []
  const isLoading = placementsQuery.isLoading

  const placementId = search.placementId
  const isEditorOpen = Boolean(placementId)

  const query = (search.q ?? '').trim().toLowerCase()
  const filteredPlacements = React.useMemo(() => {
    if (!query) return placements
    return placements.filter((item) => {
      const haystack = [
        item.name,
        item.imageAssetName ?? '',
        item.textContent ?? '',
        item.imagePosition,
        item.textPosition,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [placements, query])

  const openCreateForm = () => {
    void navigate({
      search: (prev) => ({
        ...prev,
        placementId: 'new',
      }),
    })
  }

  const openEditForm = (placement: WatermarkPlacementSummaryT) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        placementId: placement.id,
      }),
    })
  }

  const closeEditor = () => {
    void navigate({
      search: (prev) => ({
        ...prev,
        placementId: undefined,
      }),
    })
  }

  if (isEditorOpen && placementId) {
    const isNewPlacement = placementId === 'new'
    const editorReadOnly = isNewPlacement ? !canCreate : !canUpdate
    return (
      <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden overscroll-none">
        <WatermarkPlacementEditor
          placementId={placementId}
          readOnly={editorReadOnly}
          onCancel={closeEditor}
          onSuccess={closeEditor}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DataConfigBackNav
          currentLabel={t('title')}
          description={t('description')}
        />
        {canCreate ? (
          <Button type="button" onClick={openCreateForm}>
            <Plus className="size-4" />
            {t('actions.create')}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="pl-9"
              defaultValue={search.q ?? ''}
              placeholder={t('search.placeholder')}
              onChange={(event) => {
                const value = event.target.value
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    q: value.length > 0 ? value : undefined,
                  }),
                  replace: true,
                })
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>
            {t('list.total', { count: filteredPlacements.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.columns.name')}</TableHead>
                <TableHead>{t('table.columns.image')}</TableHead>
                <TableHead>{t('table.columns.text')}</TableHead>
                <TableHead>{t('table.columns.imagePosition')}</TableHead>
                <TableHead>{t('table.columns.textPosition')}</TableHead>
                <TableHead>{t('table.columns.updatedAt')}</TableHead>
                <TableHead className="text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : filteredPlacements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlacements.map((placement) => (
                  <TableRow
                    key={placement.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openEditForm(placement)}
                  >
                    <TableCell className="font-medium">
                      {placement.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          placement.imageEnabled ? 'default' : 'secondary'
                        }
                      >
                        {placement.imageEnabled
                          ? t('table.enabled')
                          : t('table.disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          placement.textEnabled ? 'default' : 'secondary'
                        }
                      >
                        {placement.textEnabled
                          ? t('table.enabled')
                          : t('table.disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getPositionLabel(t, String(placement.imagePosition))}
                    </TableCell>
                    <TableCell>
                      {getPositionLabel(t, String(placement.textPosition))}
                    </TableCell>
                    <TableCell>
                      {formatDate(placement.updatedAt, 'Pp', language)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              setDeletingPlacement(placement)
                            }}
                            aria-label={t('actions.delete')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <WatermarkPlacementDeleteDialog
        placement={deletingPlacement}
        onOpenChange={(open) => {
          if (!open) setDeletingPlacement(null)
        }}
      />
    </div>
  )
}
