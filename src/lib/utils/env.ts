import { z } from 'zod'

// Runtime environment config (injected by Docker entrypoint in production)
declare global {
  interface Window {
    __ENV__?: {
      VITE_API_URL: string
      VITE_SOCKET_URL?: string
      VITE_SOCKET_VIA_PROXY?: string | boolean
      VITE_POSTHOG_KEY?: string
      VITE_POSTHOG_HOST?: string
      VITE_SSE_BASE_URL?: string | null
      VITE_USER_SEARCH_MODE?: 'debounce' | 'enter'
      /** MinIO presigned POST TTL budget per file during folder upload (seconds). */
      VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE?: string | number
      /** Max PDF file size for folder upload (megabytes). */
      VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB?: string | number
      /** Axios request timeout (milliseconds). */
      VITE_API_TIMEOUT_MS?: string | number
      /** PDF editor mask style: 'gaussian' | 'mosaic'. */
      VITE_PDF_MASK_TYPE?: 'gaussian' | 'mosaic'
      /** PDF editor gaussian blur radius (CSS pixels). */
      VITE_PDF_MASK_GAUSSIAN_BLUR_PX?: string | number
      /** PDF editor mosaic block size (pixels). */
      VITE_PDF_MASK_MOSAIC_BLOCK_SIZE?: string | number
    }
    /** DEV: inspect active OCR socket instance */
    __ocrSocket?: unknown
  }
}

const envSchema = z.object({
  VITE_API_URL: z.string().url({
    message: 'VITE_API_URL must be a valid URL',
  }),
  VITE_SOCKET_URL: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : val,
    z
      .string()
      .url({
        message: 'VITE_SOCKET_URL must be a valid URL',
      })
      .optional(),
  ),
  VITE_SOCKET_VIA_PROXY: z
    .enum(['true', 'false'])
    .optional()
    .catch('false')
    .transform((val) => val === 'true'),
  VITE_POSTHOG_KEY: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : val,
    z.string().optional(),
  ),
  VITE_POSTHOG_HOST: z.preprocess(
    (val) =>
      val === '' || val === null || val === undefined ? undefined : val,
    z.string().url().optional(),
  ),
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
  /** User search mode: 'debounce' (default) | 'enter' */
  VITE_USER_SEARCH_MODE: z
    .enum(['debounce', 'enter'])
    .optional()
    .catch('debounce'),
  /** Folder upload: presigned POST expiry budget per file (seconds). Default 15. */
  VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(15),
  /** Folder upload: max PDF file size (MB). Default 10. */
  VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(10),
  /** Axios request timeout (ms). Default 30000. */
  VITE_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(30_000),
  /** PDF editor mask style. Default 'gaussian'. */
  VITE_PDF_MASK_TYPE: z
    .enum(['gaussian', 'mosaic'])
    .optional()
    .catch('gaussian'),
  /** PDF editor gaussian blur radius (CSS px). Default 18. */
  VITE_PDF_MASK_GAUSSIAN_BLUR_PX: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(18),
  /** PDF editor mosaic block size (px). Default 14. */
  VITE_PDF_MASK_MOSAIC_BLOCK_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(14),
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
  SOCKET_URL: parsedEnv.data.VITE_SOCKET_URL || parsedEnv.data.VITE_API_URL,
  SOCKET_VIA_PROXY: parsedEnv.data.VITE_SOCKET_VIA_PROXY ?? false,
  SSE_BASE_URL: parsedEnv.data.VITE_SSE_BASE_URL || parsedEnv.data.VITE_API_URL,
  POSTHOG_KEY: parsedEnv.data.VITE_POSTHOG_KEY,
  POSTHOG_HOST: parsedEnv.data.VITE_POSTHOG_HOST,
  USER_SEARCH_MODE: parsedEnv.data.VITE_USER_SEARCH_MODE ?? 'debounce',
  DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE:
    parsedEnv.data.VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE ?? 15,
  DATA_UPLOAD_MAX_FILE_SIZE_MB:
    parsedEnv.data.VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB ?? 10,
  DATA_UPLOAD_MAX_FILE_SIZE_BYTES:
    (parsedEnv.data.VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024,
  API_TIMEOUT_MS: parsedEnv.data.VITE_API_TIMEOUT_MS ?? 30_000,
  PDF_MASK_TYPE: parsedEnv.data.VITE_PDF_MASK_TYPE ?? 'gaussian',
  PDF_MASK_GAUSSIAN_BLUR_PX:
    parsedEnv.data.VITE_PDF_MASK_GAUSSIAN_BLUR_PX ?? 18,
  PDF_MASK_MOSAIC_BLOCK_SIZE:
    parsedEnv.data.VITE_PDF_MASK_MOSAIC_BLOCK_SIZE ?? 14,
}

export type Env = typeof env
