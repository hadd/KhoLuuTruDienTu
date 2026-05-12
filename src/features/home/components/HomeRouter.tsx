import { useTranslation } from 'react-i18next'

import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useProfile } from '@/features/auth/hooks'
import {
  getAllowedMenuGroups,
  getRoleName,
  MENU_GROUP_SCHOOL_MANAGEMENT,
  MENU_GROUP_TEACHING,
  ROLE_TEACHER,
} from '@/lib/utils/roleMenu'

// import { AdminHome } from './AdminHome'
// import { TeacherHome } from './TeacherHome'

export function HomeRouter() {
  const { t } = useTranslation('home')
  // const { currentUserRole } = useProfile()
  // const roleName = getRoleName(currentUserRole)
  // const allowedMenuGroups = getAllowedMenuGroups(roleName)

  // // Check if role has teacher permissions
  // const isTeacher = allowedMenuGroups.includes(MENU_GROUP_TEACHING)

  // // Check if role has admin permissions (school management)
  // const isAdmin = allowedMenuGroups.includes(MENU_GROUP_SCHOOL_MANAGEMENT)

  // if (isTeacher) {
  //   return <TeacherHome />
  // }

  // if (isAdmin) {
  //   return <AdminHome />
  // }

  // Fallback for no role or unknown role
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('sections.noRole.title')}</CardTitle>
            <CardDescription>
              {t('sections.noRole.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('sections.noRole.message')}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
