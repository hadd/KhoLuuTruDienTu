import { useStore } from '@tanstack/react-store'
import { Derived, Store } from '@tanstack/store'
import Cookies from 'js-cookie'

import type { TokensT, UserT } from './types'
import { getTokenExpiry } from './utils'

const STORAGE_KEY = 'auth:state'
const ACCESS_TOKEN_COOKIE = 'token'

type AuthState = {
  user: UserT | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: number | null
  roles: Array<string>
}

const baseState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  roles: [],
}

const readPersistedState = (): AuthState => {
  if (typeof window === 'undefined') {
    return baseState
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return baseState
    }
    const parsed = JSON.parse(raw) as Partial<AuthState>
    return {
      ...baseState,
      ...parsed,
    }
  } catch {
    return baseState
  }
}

const authStoreInstance = new Store<AuthState>(readPersistedState())

// Derived stores with caching (factory pattern)
// const currentSchoolIdStore = new Derived({
//   fn: () => authStoreInstance.state.user?.school?.id ?? null,
//   deps: [authStoreInstance],
// })
// currentSchoolIdStore.mount()

const currentUserRoleStore = new Derived({
  fn: () =>
    authStoreInstance.state.user?.userRoles?.find((role) => role.isCurrent) ??
    null,
  deps: [authStoreInstance],
})
currentUserRoleStore.mount()

const persistState = (state: AuthState) => {
  if (typeof window === 'undefined') {
    return
  }
  if (
    !state.accessToken &&
    !state.refreshToken &&
    !state.user &&
    state.roles.length === 0
  ) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const setState = (updater: (state: AuthState) => AuthState) => {
  const nextState = updater(authStoreInstance.state)
  authStoreInstance.setState(nextState)
  persistState(nextState)
  return nextState
}

export const authStore = {
  subscribe: authStoreInstance.subscribe,
  getState: () => authStoreInstance.state,
  setTokens: (tokens: TokensT) => {
    const tokenExpiresAt = getTokenExpiry(tokens.accessToken)
    const next = setState((state) => ({
      ...state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt,
    }))
    Cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken)
    return next
  },
  setUser: (user: UserT | null) => {
    return setState((state) => ({
      ...state,
      user,
    }))
  },
  setRoles: (roles: Array<string>) => {
    return setState((state) => ({
      ...state,
      roles,
    }))
  },
  reset: () => {
    authStoreInstance.setState(baseState)
    persistState(baseState)
    Cookies.remove(ACCESS_TOKEN_COOKIE)
    // Explicit cleanup of localStorage (redundant but safe)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  },
}

export const useAuthStore = <T>(selector: (state: AuthState) => T) =>
  useStore<AuthState, T>(authStoreInstance, selector)

export const getAccessToken = () => authStoreInstance.state.accessToken
export const getRefreshToken = () => authStoreInstance.state.refreshToken
export const getTokenExpiryTime = () => authStoreInstance.state.tokenExpiresAt
export const getUserRoles = () => authStoreInstance.state.roles

// Computed getters with caching via Derived stores
// export const getCurrentSchoolId = () => currentSchoolIdStore.state
export const getCurrentUserRole = () => currentUserRoleStore.state

// Hooks using derived stores (optional - can also use selectors)
// export const useCurrentSchoolId = () => useStore(currentSchoolIdStore)
export const useCurrentUserRole = () => useStore(currentUserRoleStore)
