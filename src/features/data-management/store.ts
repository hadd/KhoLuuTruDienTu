import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

import { ALL_PROJECTS_CODE } from '@/features/data-management/lib/constants'

const STORAGE_KEY = 'data-management:admin-project-code'

type AdminProjectState = {
  projectCode: string | null
}

function clearPersistedProjectCode() {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore persistence errors
  }
}

function readPersistedProjectCode(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value?.trim() || value.trim() === ALL_PROJECTS_CODE) {
      if (value) {
        clearPersistedProjectCode()
      }
      return null
    }
    return value
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
    if (!trimmed || trimmed === ALL_PROJECTS_CODE) {
      if (adminProjectStoreInstance.state.projectCode !== null) {
        adminProjectStoreInstance.setState({ projectCode: null })
      }
      clearPersistedProjectCode()
      return
    }
    if (adminProjectStoreInstance.state.projectCode === trimmed) return
    adminProjectStoreInstance.setState({ projectCode: trimmed })
    persistProjectCode(trimmed)
  },
  clearProjectCode: () => {
    if (adminProjectStoreInstance.state.projectCode !== null) {
      adminProjectStoreInstance.setState({ projectCode: null })
    }
    clearPersistedProjectCode()
  },
}

export function useAdminProjectCode() {
  return useStore(adminProjectStoreInstance, (state) => state.projectCode)
}
