import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'
import { IssueReportNotificationBell } from '@/features/project-manager/components/IssueReportNotificationBell'

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <AppLogo className="h-9 w-auto" />
      <div className="flex items-center gap-2">
        <IssueReportNotificationBell />
        <UserAccountMenu variant="header" />
      </div>
    </header>
  )
}
