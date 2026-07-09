import * as React from 'react'

import { playNotificationSound, resumeNotificationAudioContext } from '@/features/notifications/lib/playNotificationSound'

const BELL_SHAKE_DURATION_MS = 1_500

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useNotificationAlert() {
  const [isShaking, setIsShaking] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const unlockAudio = () => {
      void resumeNotificationAudioContext()
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  const stopShake = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsShaking(false)
  }, [])

  const triggerShake = React.useCallback(() => {
    if (prefersReducedMotion()) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setIsShaking(true)
    timeoutRef.current = setTimeout(() => {
      setIsShaking(false)
      timeoutRef.current = null
    }, BELL_SHAKE_DURATION_MS)
  }, [])

  const triggerAlert = React.useCallback(() => {
    triggerShake()
    void playNotificationSound()
  }, [triggerShake])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { isShaking, triggerAlert, stopShake }
}
