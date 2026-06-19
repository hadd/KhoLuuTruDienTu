import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import { useDataManagementProjectSelection } from '@/features/data-management/hooks/useDataManagementProjectSelection'

export function DataManagementHeaderProjectSelect() {
  const isAdmin = getPrimaryAppRole(getUserRoles()) === 'admin'
  const { projectCode, handleProjectChange } =
    useDataManagementProjectSelection()

  if (!isAdmin) {
    return null
  }

  return (
    <ProjectSelect
      className="w-44 sm:w-52"
      value={projectCode}
      onValueChange={handleProjectChange}
    />
  )
}
