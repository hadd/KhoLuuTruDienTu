import { z } from 'zod'

// Runtime environment config (injected by Docker entrypoint in production)
declare global {
  interface Window {
    __ENV__?: {
      VITE_API_URL: string
      VITE_POSTHOG_KEY?: string
      VITE_POSTHOG_HOST?: string
      VITE_SSE_BASE_URL?: string | null
    }
  }
}

const envSchema = z.object({
  VITE_API_URL: z.string().url({
    message: 'VITE_API_URL must be a valid URL',
  }),
  VITE_POSTHOG_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().url().optional(),
  VITE_SSE_BASE_URL: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : val,
    z
      .string()
      .url({
        message: 'VITE_SSE_BASE_URL must be a valid URL',
      })
      .optional(),
  ),
})

// Use runtime config if available (production), otherwise use build-time env (development)
const rawEnv =
  typeof window !== 'undefined' && window.__ENV__
    ? window.__ENV__
    : import.meta.env

const parsedEnv = envSchema.safeParse(rawEnv)

if (!parsedEnv.success) {
  const issueMessages = parsedEnv.error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return `- ${path}: ${issue.message}`
    })
    .join('\n')

  throw new Error(`Invalid environment variables:\n${issueMessages}`)
}

export const env = {
  API_URL: parsedEnv.data.VITE_API_URL,
  SSE_BASE_URL: parsedEnv.data.VITE_SSE_BASE_URL || parsedEnv.data.VITE_API_URL,
  POSTHOG_KEY: parsedEnv.data.VITE_POSTHOG_KEY,
  POSTHOG_HOST: parsedEnv.data.VITE_POSTHOG_HOST,
}

export type Env = typeof env
