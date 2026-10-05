import { createS3Client } from "@shared/s3-client"
import type { S3Config } from "@shared/s3-client"
import { env } from "../env.ts"

const DEFAULT_EXPIRY_SECONDS = 86400 // 1 day

let cachedConfig: S3Config | null | undefined
let cachedClient: ReturnType<typeof createS3Client> | null = null

export async function getS3Client(): Promise<ReturnType<typeof createS3Client> | null> {
  return await ensureClient()
}

async function ensureClient(): Promise<ReturnType<typeof createS3Client> | null> {
  if (cachedClient) return cachedClient
  if (cachedConfig === undefined) {
    cachedConfig = env.S3
  }
  if (!cachedConfig) return null
  cachedClient = createS3Client({ config: cachedConfig })
  await cachedClient.ensureBucketExists(cachedConfig.bucket)
  return cachedClient
}

interface PresignedUrlCache {
  url: string
  expiresAt: number
}
const urlCache = new Map<string, PresignedUrlCache>()

export async function buildFileUrlFromRegistry(
  fileRegistry?: { bucket?: string; filePath?: string },
  options: { expirySeconds?: number } = {},
): Promise<string | undefined> {
  const { expirySeconds = DEFAULT_EXPIRY_SECONDS } = options
  if (!fileRegistry?.bucket || !fileRegistry?.filePath) return undefined
  
  const cacheKey = `${fileRegistry.bucket}:${fileRegistry.filePath}`
  const now = Date.now()
  const cached = urlCache.get(cacheKey)

  // Serve from cache if it exists and is valid for at least 5 more minutes
  if (cached && cached.expiresAt > now + 300 * 1000) {
    return cached.url
  }

  const s3 = await ensureClient()
  if (!s3) return undefined

  const url = await s3.getMinIOClient().presignedGetObject(
    fileRegistry.bucket,
    fileRegistry.filePath,
    expirySeconds,
  )
  
  urlCache.set(cacheKey, {
    url,
    expiresAt: now + expirySeconds * 1000,
  })

  return url
}

export async function attachFileUrl<T extends { fileRegistry?: any }>(
  record: T,
  options: { expirySeconds?: number } = {},
): Promise<T & { fileUrl?: string }> {
  const url = await buildFileUrlFromRegistry(record?.fileRegistry, options)
  return url ? { ...record, fileUrl: url } : record
}

export async function attachFileUrlMany<T extends { fileRegistry?: any }>(
  records: T[],
  options: { expirySeconds?: number } = {},
): Promise<Array<T & { fileUrl?: string }>> {
  if (!records?.length) return records as Array<T & { fileUrl?: string }>
  return await Promise.all(records.map((r) => attachFileUrl(r, options)))
}

export const s3Client = {
  get sys() {
    return ensureClient()
  },
}
