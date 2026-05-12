import posthog from 'posthog-js'

import { authStore } from '@/features/auth/store'
import { env } from '@/lib/utils/env'

export const initPostHog = () => {
  if (import.meta.env.DEV) return
  const key = env.POSTHOG_KEY
  const host = env.POSTHOG_HOST
  if (!key || !host) return
  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: true,
  })
}

const resetPostHog = () => {
  if ((posthog as { __loaded?: boolean }).__loaded) {
    posthog.reset()
  }
}

let inited = false
const syncPostHogWithAuth = () => {
  const { accessToken, user } = authStore.getState()
  const hasToken = Boolean(accessToken)

  if (hasToken && !inited) {
    initPostHog()
    inited = true
  } else if (!hasToken && inited) {
    resetPostHog()
    inited = false
  }

  if (inited && user && (posthog as { __loaded?: boolean }).__loaded) {
    posthog.identify(user.id, {
      email: user.email,
      name: user.fullName,
    })
  }
}

export const subscribePostHogToAuth = () => {
  if (typeof window === 'undefined') return () => {}
  syncPostHogWithAuth()
  return authStore.subscribe(syncPostHogWithAuth)
}

export { posthog }
