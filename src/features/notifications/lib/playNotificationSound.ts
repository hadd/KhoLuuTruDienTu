import { isNotificationSoundEnabled } from '@/features/notifications/lib/notificationAlertPreferences'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!audioContext) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextCtor) return null
    audioContext = new AudioContextCtor()
  }

  return audioContext
}

export async function resumeNotificationAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx || ctx.state !== 'suspended') return
  await ctx.resume()
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

export async function playNotificationSound(): Promise<void> {
  if (!isNotificationSoundEnabled()) return

  const ctx = getAudioContext()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const startAt = ctx.currentTime
    playTone(ctx, 880, startAt, 0.18)
    playTone(ctx, 1_176, startAt + 0.1, 0.22)
  } catch {
    // Browser autoplay policy may block playback until user interaction.
  }
}
