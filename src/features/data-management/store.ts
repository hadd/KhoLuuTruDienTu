import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

const STORAGE_KEY = 'data-management:admin-project-code'

type AdminProjectState = {
  projectCode: string | null
}

function readPersistedProjectCode(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const adminProjectStoreInstance = new Store<AdminProjectState>({
  projectCode: readPersistedProjectCode(),
})

function persistProjectCode(projectCode: string) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, projectCode)
  } catch {
    // ignore persistence errors
  }
}

export const adminProjectStore = {
  subscribe: adminProjectStoreInstance.subscribe,
  getState: () => adminProjectStoreInstance.state,
  setProjectCode: (projectCode: string) => {
    const trimmed = projectCode.trim()
    if (!trimmed) return
    adminProjectStoreInstance.setState({ projectCode: trimmed })
    persistProjectCode(trimmed)
  },
}

export function useAdminProjectCode() {
  return useStore(adminProjectStoreInstance, (state) => state.projectCode)
}
