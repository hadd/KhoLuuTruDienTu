import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  Bell,
  Mail,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@tanstack/react-form'

import { StatusBadge } from '@/components/common/StatusBadge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
import {
  notificationTypeOptions,
} from '@/features/notification-config/api/notificationConfigClient'
import {
  notificationConfigsQueryOptions,
  emailSenderQueryOptions,
  useCreateNotificationConfig,
  useDeleteNotificationConfig,
  useUpdateNotificationConfig,
  useUpdateNotificationConfigStatus,
} from '@/features/notification-config/queries'
import {
  EmailChannelWarning,
  EmailSenderSection,
} from '@/features/notification-config/components/EmailSenderSection'
import {
  canActivateNotificationConfig,
  getActivateDisabledReasonKey,
  showEmailChannelWarning,
} from '@/features/notification-config/notificationConfigUtils'
import { notificationConfigFormSchema } from '@/features/notification-config/schemas'
import type {
  EmailConfigStatusT,
  NotificationChannelT,
  NotificationConfigT,
  NotificationTypeT,
} from '@/features/notification-config/types'
import { adminRolesQueryOptions } from '@/features/user/queries'
import type { AdminRoleT } from '@/features/user/types'
import { FormField, useAppForm } from '@/lib/forms'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

const routeApi = getRouteApi('/app/data-config/notification-configs')
const ALL_FILTER_VALUE = 'all'

const channelOptions: Array<{
  id: NotificationChannelT
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'system', icon: Bell },
  { id: 'email', icon: Mail },
]

type TranslateFn = (key: string, options?: Record<string, unknown>) => string

function getChannelLabel(
  t: TranslateFn,
  channel: NotificationChannelT,
): string {
  if (channel === 'email') return t('channels.email')
  return t('channels.system')
}

function getChannelDescription(
  t: TranslateFn,
  channel: NotificationChannelT,
): string {
  if (channel === 'email') return t('channelDescriptions.email')
  return t('channelDescriptions.system')
}

function getRoleLabel(
  roleId: string,
  rolesById: Map<string, AdminRoleT>,
): string {
  const role = rolesById.get(roleId)
  if (!role) return roleId
  return role.name
}

function countActiveUsers(role: AdminRoleT): number {
  return role.userRoles?.length ?? 0
}

function getNotificationTypeLabel(
  t: TranslateFn,
  notificationType: NotificationTypeT,
): string {
  return t(`notificationTypes.${notificationType}.label`)
}

function getNotificationTypeDescription(
  t: TranslateFn,
  notificationType: NotificationTypeT,
): string {
  return t(`notificationTypes.${notificationType}.description`)
}

function getDefaultFormValues(
  config?: NotificationConfigT | null,
  fallbackRoleIds: Array<string> = [],
  emailStatus?: EmailConfigStatusT,
): {
  notificationType: NotificationTypeT
  channels: Array<NotificationChannelT>
  roleIds: Array<string>
  active: boolean
} {
  const channels = config?.channels ?? ['system']
  const shouldDefaultInactive =
    !config &&
    channels.includes('email') &&
    emailStatus?.configured !== true

  return {
    notificationType: config?.notificationType ?? 'OCR_COMPLETED',
    channels,
    roleIds: config?.roleIds ?? fallbackRoleIds,
    active: config?.active ?? !shouldDefaultInactive,
  }
}

export function NotificationConfigPage() {
  const { t } = useTranslation('notification-config')
  const tr = React.useCallback<TranslateFn>(
    (key, options) =>
      (t as unknown as TranslateFn)(key, options),
    [t],
  )
  const language = useCurrentLanguage()
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [editingConfig, setEditingConfig] =
    React.useState<NotificationConfigT | null>(null)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [deletingConfig, setDeletingConfig] =
    React.useState<NotificationConfigT | null>(null)

  const { data: configs = [], isLoading } = useQuery(
    notificationConfigsQueryOptions(),
  )
  const { data: emailStatus } = useQuery(emailSenderQueryOptions())
  const { data: roles = [] } = useQuery(adminRolesQueryOptions())
  const rolesById = React.useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  )
  const statusMutation = useUpdateNotificationConfigStatus()
  const deleteMutation = useDeleteNotificationConfig()

  React.useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const filteredConfigs = React.useMemo(() => {
    const query = (search.q ?? '').trim().toLowerCase()
    const result: Array<NotificationConfigT> = []

    for (const config of configs) {
      const typeLabel = getNotificationTypeLabel(tr, config.notificationType)
      const roleLabels = config.roleIds
        .map((roleId) => getRoleLabel(roleId, rolesById))
        .join(' ')
      const searchableText = `${typeLabel} ${roleLabels}`.toLowerCase()

      if (query.length > 0 && searchableText.indexOf(query) === -1) {
        continue
      }
      if (search.channel && !config.channels.includes(search.channel)) {
        continue
      }
      if (search.roleId && !config.roleIds.includes(search.roleId)) {
        continue
      }
      if (
        search.notificationType &&
        config.notificationType !== search.notificationType
      ) {
        continue
      }
      if (search.status === 'active' && !config.active) continue
      if (search.status === 'inactive' && config.active) continue

      result.push(config)
    }

    return result
  }, [configs, rolesById, search, tr])

  const openCreateForm = () => {
    setEditingConfig(null)
    setIsFormOpen(true)
  }

  const openEditForm = (config: NotificationConfigT) => {
    setEditingConfig(config)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingConfig(null)
  }

  const updateSearch = (
    patch: Partial<{
      q: string
      channel: NotificationChannelT
      roleId: string
      notificationType: NotificationTypeT
      status: 'active' | 'inactive'
    }>,
  ) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
    })
  }

  const clearFilters = () => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        q: undefined,
        channel: undefined,
        roleId: undefined,
        notificationType: undefined,
        status: undefined,
      }),
    })
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <EmailSenderSection />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button type="button" onClick={openCreateForm}>
            <Plus className="size-4" />
            {t('actions.create')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(150px,180px))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search.q ?? ''}
                onChange={(event) =>
                  updateSearch({ q: event.target.value || undefined })
                }
                placeholder={t('search.placeholder')}
                className="pl-9"
              />
            </div>

            <FilterSelect
              value={search.channel}
              placeholder={t('filter.channel')}
              options={channelOptions.map((channel) => ({
                value: channel.id,
                label: getChannelLabel(tr, channel.id),
              }))}
              onChange={(value) =>
                updateSearch({
                  channel:
                    value === ALL_FILTER_VALUE
                      ? undefined
                      : (value as NotificationChannelT),
                })
              }
            />

            <FilterSelect
              value={search.roleId}
              placeholder={t('filter.role')}
              options={roles.map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              onChange={(value) =>
                updateSearch({
                  roleId:
                    value === ALL_FILTER_VALUE
                      ? undefined
                      : value,
                })
              }
            />

            <FilterSelect
              value={search.notificationType}
              placeholder={t('filter.notificationType')}
              options={notificationTypeOptions.map((type) => ({
                value: type.id,
                label: getNotificationTypeLabel(tr, type.id),
              }))}
              onChange={(value) =>
                updateSearch({
                  notificationType:
                    value === ALL_FILTER_VALUE
                      ? undefined
                      : (value as NotificationTypeT),
                })
              }
            />

            <FilterSelect
              value={search.status}
              placeholder={t('filter.status')}
              options={[
                { value: 'active', label: t('status.active') },
                { value: 'inactive', label: t('status.inactive') },
              ]}
              onChange={(value) =>
                updateSearch({
                  status:
                    value === ALL_FILTER_VALUE
                      ? undefined
                      : (value as 'active' | 'inactive'),
                })
              }
            />

            <Button type="button" variant="outline" onClick={clearFilters}>
              <RotateCcw className="size-4" />
              {t('filter.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>
            {t('list.total', { count: filteredConfigs.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.columns.notificationType')}</TableHead>
                <TableHead>{t('table.columns.channels')}</TableHead>
                <TableHead>{t('table.columns.roles')}</TableHead>
                <TableHead>{t('table.columns.status')}</TableHead>
                <TableHead>{t('table.columns.updatedBy')}</TableHead>
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
              ) : filteredConfigs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredConfigs.map((config) => {
                  const activateDisabledReason = getActivateDisabledReasonKey(
                    config,
                    emailStatus,
                  )
                  const canActivate = canActivateNotificationConfig(
                    config,
                    emailStatus,
                  )
                  const isActivateDisabled =
                    !config.active &&
                    !canActivate &&
                    activateDisabledReason !== null

                  return (
                  <TableRow
                    key={config.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openEditForm(config)}
                  >
                    <TableCell className="min-w-[220px]">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {getNotificationTypeLabel(
                            tr,
                            config.notificationType,
                          )}
                        </p>
                        <p className="max-w-[280px] text-xs text-muted-foreground">
                          {getNotificationTypeDescription(
                            tr,
                            config.notificationType,
                          )}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {config.channels.map((channel) => (
                          <ChannelBadge key={channel} channel={channel} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {config.roleIds.map((roleId) => (
                          <Badge key={roleId} variant="secondary">
                            {getRoleLabel(roleId, rolesById)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={config.active ? 'active' : 'inactive'}
                        label={
                          config.active
                            ? t('status.active')
                            : t('status.inactive')
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {config.updatedById ?? t('table.updatedByUnknown')}
                    </TableCell>
                    <TableCell>
                      {formatDate(config.updatedAt, 'Pp', language)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isActivateDisabled ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  disabled
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label={t('actions.activate')}
                                >
                                  <Power className="size-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t(`errors.${activateDisabledReason}`)}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={statusMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              statusMutation.mutate({
                                configId: config.id,
                                active: !config.active,
                              })
                            }}
                            aria-label={
                              config.active
                                ? t('actions.deactivate')
                                : t('actions.activate')
                            }
                          >
                            <Power className="size-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeletingConfig(config)
                          }}
                          aria-label={t('actions.delete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NotificationConfigFormDialog
        key={editingConfig?.id ?? 'new'}
        open={isFormOpen}
        config={editingConfig}
        roles={roles}
        emailStatus={emailStatus}
        onOpenChange={(open) => {
          if (!open) closeForm()
          else setIsFormOpen(true)
        }}
        onSuccess={closeForm}
      />

      <AlertDialog
        open={Boolean(deletingConfig)}
        onOpenChange={(open) => {
          if (!open) setDeletingConfig(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.confirmDescription', {
                type: deletingConfig
                  ? getNotificationTypeLabel(
                      tr,
                      deletingConfig.notificationType,
                    )
                  : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingConfig) return
                deleteMutation.mutate(deletingConfig.id)
                setDeletingConfig(null)
              }}
            >
              {t('delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value?: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('notification-config')

  return (
    <Select value={value ?? ALL_FILTER_VALUE} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FILTER_VALUE}>{t('filter.all')}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ChannelBadge({ channel }: { channel: NotificationChannelT }) {
  const { t } = useTranslation('notification-config')
  const tr = React.useCallback<TranslateFn>(
    (key, options) => (t as unknown as TranslateFn)(key, options),
    [t],
  )
  const Icon = channelOptions.find((option) => option.id === channel)?.icon

  return (
    <Badge variant="outline" className="gap-1">
      {Icon ? <Icon className="size-3" /> : null}
      {getChannelLabel(tr, channel)}
    </Badge>
  )
}

function NotificationConfigFormDialog({
  open,
  config,
  roles,
  emailStatus,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  config: NotificationConfigT | null
  roles: Array<AdminRoleT>
  emailStatus?: EmailConfigStatusT
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('notification-config')
  const tr = React.useCallback<TranslateFn>(
    (key, options) => (t as unknown as TranslateFn)(key, options),
    [t],
  )
  const createMutation = useCreateNotificationConfig()
  const updateMutation = useUpdateNotificationConfig()
  const isEditing = Boolean(config)
  const isSaving = createMutation.isPending || updateMutation.isPending

  const form = useAppForm({
    schema: notificationConfigFormSchema,
    defaultValues: getDefaultFormValues(
      config,
      roles[0]?.id ? [roles[0].id] : [],
      emailStatus,
    ),
    onSubmit: async ({ value }) => {
      const payload = { ...value }
      if (
        !config &&
        payload.channels.includes('email') &&
        emailStatus?.configured !== true &&
        payload.active
      ) {
        payload.active = false
      }

      if (config) {
        await updateMutation.mutateAsync({
          configId: config.id,
          payload,
        })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onSuccess()
    },
  })

  const selectedChannels = useStore(
    form.store,
    (state) =>
      (state as { values: { channels: Array<NotificationChannelT> } }).values
        .channels,
  )
  const showEmailWarning = showEmailChannelWarning(selectedChannels, emailStatus)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <FormField
            form={form}
            name="notificationType"
            label={t('form.fields.notificationType.label')}
            render={(field) => (
              <Select
                value={field.state.value}
                onValueChange={(value) =>
                  field.handleChange(value as NotificationTypeT)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t(
                      'form.fields.notificationType.placeholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypeOptions.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="space-y-0.5">
                        <p>{getNotificationTypeLabel(tr, type.id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {getNotificationTypeDescription(tr, type.id)}
                        </p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <FormField
            form={form}
            name="channels"
            label={t('form.fields.channels.label')}
            description={t('form.fields.channels.description')}
            render={(field) => (
              <div className="space-y-3">
                <CheckboxGroup
                  values={field.state.value as Array<NotificationChannelT>}
                  options={channelOptions.map((channel) => ({
                    id: channel.id,
                    label: getChannelLabel(tr, channel.id),
                    description: getChannelDescription(tr, channel.id),
                  }))}
                  onChange={(nextValues) => field.handleChange(nextValues)}
                />
                {showEmailWarning ? <EmailChannelWarning /> : null}
              </div>
            )}
          />

          <FormField
            form={form}
            name="roleIds"
            label={t('form.fields.roleIds.label')}
            description={t('form.fields.roleIds.description')}
            render={(field) => (
              <CheckboxGroup
                values={field.state.value as Array<string>}
                options={roles.map((role) => {
                  const activeUserCount = countActiveUsers(role)
                  return {
                    id: role.id,
                    label: role.name,
                    description:
                      activeUserCount > 0
                        ? t('rolesMeta.activeUsers', {
                            count: activeUserCount,
                          })
                        : t('rolesMeta.noActiveUsers'),
                    warning: activeUserCount === 0,
                  }
                })}
                onChange={(nextValues) => field.handleChange(nextValues)}
              />
            )}
          />

          <FormField
            form={form}
            name="active"
            label={t('form.fields.active.label')}
            description={t('form.fields.active.description')}
            render={(field) => (
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <Switch
                  checked={Boolean(field.state.value)}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <span className="text-sm text-muted-foreground">
                  {field.state.value
                    ? t('status.active')
                    : t('status.inactive')}
                </span>
              </div>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('form.actions.saving') : t('form.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CheckboxGroup<TValue extends string>({
  values,
  options,
  onChange,
}: {
  values: Array<TValue>
  options: Array<{
    id: TValue
    label: string
    description: string
    warning?: boolean
  }>
  onChange: (values: Array<TValue>) => void
}) {
  const toggleValue = (value: TValue, checked: boolean) => {
    if (checked) {
      onChange([...values, value])
      return
    }

    onChange(values.filter((item) => item !== value))
  }

  return (
    <div className="grid gap-2">
      {options.map((option) => {
        const checked = values.includes(option.id)
        return (
          <Label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3',
              checked && 'bg-accent',
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(nextChecked) =>
                toggleValue(option.id, nextChecked === true)
              }
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">{option.label}</span>
              <span
                className={cn(
                  'block text-xs text-muted-foreground',
                  option.warning && 'text-destructive',
                )}
              >
                {option.description}
              </span>
            </span>
          </Label>
        )
      })}
    </div>
  )
}

