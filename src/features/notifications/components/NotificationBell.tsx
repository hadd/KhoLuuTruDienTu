import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Bell, Loader2 } from 'lucide-react'
import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getPrimaryAppRoleFromProfile } from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import { useDataManagementRole } from '@/features/data-management/hooks/useDataManagementRole'
import { useNotificationAlert } from '@/features/notifications/hooks/useNotificationAlert'
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket'
import { buildNotificationNavigation } from '@/features/notifications/lib/notificationNavigation'
import {
  NOTIFICATION_LIST_LIMIT,
  notificationUnreadCountQueryOptions,
  notificationsListQueryOptions,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/features/notifications/queries'
import type { NotificationInboxRecordT } from '@/features/notifications/types'
import { CloseIssueReportDialog } from '@/features/project-manager/components/CloseIssueReportDialog'
import { IssueReportNotificationItem } from '@/features/project-manager/components/IssueReportNotificationItem'
import {
  buildIssueReportDossierNavigation,
  canNavigateToIssueReportDossier,
} from '@/features/project-manager/lib/issueReportNavigation'
import { adminIssueReportsQueryOptions } from '@/features/project-manager/queries'
import type { AdminIssueReportT } from '@/features/project-manager/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'

type NotificationCenterFilterT = 'all' | 'actionRequired' | 'system'

function NotificationItem({
  notification,
  onOpen,
}: {
  notification: NotificationInboxRecordT
  onOpen: (notification: NotificationInboxRecordT) => void
}) {
  const { t } = useTranslation('notifications')
  const language = useCurrentLanguage()
  const isUnread = !notification.readAt

  return (
    <button
      type="button"
      className={cn(
        'w-full space-y-1 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0',
        'hover:bg-muted/60',
        isUnread && 'bg-muted/30',
      )}
      onClick={() => onOpen(notification)}
    >
      <div className="flex items-start justify-between gap-2">
        <TextBlock
          lines={1}
          className={cn(
            'text-sm text-foreground',
            isUnread && 'font-semibold',
          )}
        >
          {notification.title}
        </TextBlock>
        {isUnread ? (
          <span
            className="mt-1 size-2 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
        ) : null}
      </div>
      <TextBlock lines={2} className="text-xs text-muted-foreground">
        {notification.body}
      </TextBlock>
      <p className="text-xs text-muted-foreground">
        {formatDate(notification.createdAt, 'PPp', language)}
      </p>
      <span className="sr-only">
        {isUnread ? t('item.unread') : t('item.read')}
      </span>
    </button>
  )
}

function NotificationFilterChip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count?: number
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={onClick}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span className="ml-1 text-muted-foreground">({count})</span>
      ) : null}
    </Button>
  )
}

function NotificationSectionHeading({ title }: { title: string }) {
  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
    </div>
  )
}

export function NotificationBell() {
  const { t } = useTranslation('notifications')
  const { t: tProjectManager } = useTranslation('project-manager')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<NotificationCenterFilterT>('all')
  const [closingReport, setClosingReport] = useState<AdminIssueReportT | null>(
    null,
  )
  const isAuthenticated = Boolean(getAccessToken())
  const { isShaking, triggerAlert, stopShake } = useNotificationAlert()

  const handleRealtimeNotification = useCallback(() => {
    triggerAlert()
  }, [triggerAlert])

  useNotificationSocket(isAuthenticated, {
    onNotificationNew: handleRealtimeNotification,
  })

  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: isAuthenticated,
  })

  const primaryAppRole = useMemo(
    () => getPrimaryAppRoleFromProfile(user),
    [user],
  )
  const dataManagementRole = useDataManagementRole()

  const canViewIssueReports =
    primaryAppRole === 'manager' || primaryAppRole === 'admin'

  const { data: unreadCount = 0 } = useQuery({
    ...notificationUnreadCountQueryOptions(),
    enabled: isAuthenticated,
  })

  const { data: notifications = [], isLoading: isLoadingNotifications } =
    useQuery({
      ...notificationsListQueryOptions({ limit: NOTIFICATION_LIST_LIMIT }),
      enabled: isAuthenticated && open,
    })

  const { data: issueReports = [], isLoading: isLoadingIssueReports } =
    useQuery({
      ...adminIssueReportsQueryOptions(),
      enabled: canViewIssueReports && isAuthenticated,
    })

  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  const escalatedReports = useMemo(
    () => issueReports.filter((report) => report.status === 'ESCALATED'),
    [issueReports],
  )

  const actionRequiredCount = escalatedReports.length
  const totalBadgeCount =
    unreadCount + (canViewIssueReports ? actionRequiredCount : 0)

  const isLoading =
    isLoadingNotifications || (canViewIssueReports && isLoadingIssueReports)

  const summaryText = useMemo(() => {
    if (canViewIssueReports && unreadCount > 0 && actionRequiredCount > 0) {
      return t('summary.mixed', {
        systemCount: unreadCount,
        actionCount: actionRequiredCount,
      })
    }

    if (unreadCount > 0) {
      return t('unreadCount', { count: unreadCount })
    }

    if (canViewIssueReports && actionRequiredCount > 0) {
      return tProjectManager('issueReports.pendingCount', {
        count: actionRequiredCount,
      })
    }

    return null
  }, [
    actionRequiredCount,
    canViewIssueReports,
    t,
    tProjectManager,
    unreadCount,
  ])

  const showActionRequiredSection =
    canViewIssueReports && filter === 'all' && escalatedReports.length > 0

  const showSystemSection = filter === 'all' || filter === 'system'

  const showIssueReportList =
    canViewIssueReports && filter === 'actionRequired'

  const isEmpty =
    !isLoading &&
    (filter === 'all'
      ? escalatedReports.length === 0 && notifications.length === 0
      : filter === 'actionRequired'
        ? issueReports.length === 0
        : notifications.length === 0)

  if (!isAuthenticated) {
    return null
  }

  async function handleOpenNotification(notification: NotificationInboxRecordT) {
    const navigation = buildNotificationNavigation(notification, {
      dataManagementRole,
    })
    if (!navigation) {
      toast.error(t('errors.navigationFailed'))
      return
    }

    setOpen(false)

    if (!notification.readAt) {
      try {
        await markReadMutation.mutateAsync(notification.id)
      } catch {
        // Navigation should still proceed even if mark-read fails.
      }
    }

    void navigate(navigation)
  }

  function handleOpenIssueReportDossier(report: AdminIssueReportT) {
    const navigation = buildIssueReportDossierNavigation(report)
    if (!navigation) {
      toast.error(tProjectManager('issueReports.errors.missingNavigationContext'))
      return
    }

    setOpen(false)
    void navigate(navigation)
  }

  async function handleMarkAllRead() {
    try {
      await markAllReadMutation.mutateAsync()
    } catch {
      toast.error(t('errors.markAllReadFailed'))
    }
  }

  function renderIssueReportItem(report: AdminIssueReportT) {
    return (
      <IssueReportNotificationItem
        key={report.id}
        report={report}
        canOpenDossier={canNavigateToIssueReportDossier(report)}
        onActivate={(selected) => {
          setClosingReport(selected)
          setOpen(false)
        }}
        onOpenDossier={handleOpenIssueReportDossier}
      />
    )
  }

  function renderEmptyState() {
    if (filter === 'actionRequired') {
      return (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {tProjectManager('issueReports.empty')}
        </p>
      )
    }

    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        {t('empty')}
      </p>
    )
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) {
            stopShake()
          } else {
            setFilter('all')
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('bellLabel')}
          >
            <Bell className={cn('size-4', isShaking && 'animate-bell-shake')} />
            {totalBadgeCount > 0 ? (
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground',
                )}
              >
                {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t('title')}
              </h3>
              {summaryText ? (
                <p className="text-xs text-muted-foreground">{summaryText}</p>
              ) : null}
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={markAllReadMutation.isPending}
                onClick={() => void handleMarkAllRead()}
              >
                {t('actions.markAllRead')}
              </Button>
            ) : null}
          </div>

          {canViewIssueReports ? (
            <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
              <NotificationFilterChip
                active={filter === 'all'}
                label={t('filters.all')}
                onClick={() => setFilter('all')}
              />
              <NotificationFilterChip
                active={filter === 'actionRequired'}
                count={actionRequiredCount}
                label={t('filters.actionRequired')}
                onClick={() => setFilter('actionRequired')}
              />
              <NotificationFilterChip
                active={filter === 'system'}
                count={unreadCount}
                label={t('filters.system')}
                onClick={() => setFilter('system')}
              />
            </div>
          ) : null}

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : isEmpty ? (
              renderEmptyState()
            ) : (
              <>
                {showActionRequiredSection ? (
                  <>
                    <NotificationSectionHeading
                      title={t('sections.actionRequired')}
                    />
                    {escalatedReports.map(renderIssueReportItem)}
                  </>
                ) : null}

                {showIssueReportList ? (
                  issueReports.map(renderIssueReportItem)
                ) : null}

                {showSystemSection && notifications.length > 0 ? (
                  <>
                    {canViewIssueReports && filter === 'all' ? (
                      <NotificationSectionHeading title={t('sections.system')} />
                    ) : null}
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onOpen={(item) => void handleOpenNotification(item)}
                      />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <CloseIssueReportDialog
        report={closingReport}
        open={closingReport !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setClosingReport(null)
          }
        }}
      />
    </>
  )
}
