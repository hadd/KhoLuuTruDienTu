import type { UserT } from '@/features/auth/types'
import { getUsersByPermission } from '@/features/user/api/userClient'
import { PROJECT_MANAGER_CANDIDATE_PERMISSIONS } from '@/features/project-manager/lib/projectManagerPermissions'

function mergeUsersById(users: Array<UserT>): Array<UserT> {
  const byId = new Map<string, UserT>()

  for (const user of users) {
    byId.set(user.id, user)
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.fullName.localeCompare(right.fullName, 'vi'),
  )
}

export async function getProjectManagerCandidates(): Promise<Array<UserT>> {
  const responses = await Promise.all(
    PROJECT_MANAGER_CANDIDATE_PERMISSIONS.map((permission) =>
      getUsersByPermission(permission),
    ),
  )

  return mergeUsersById(responses.flatMap((response) => response.items))
}
