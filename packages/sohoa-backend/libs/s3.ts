import { createS3Client } from "@shared/s3-client"
import type { S3Config } from "@shared/s3-client"
import { env } from "../env.ts"

const DEFAULT_EXPIRY_SECONDS = 86400 // 1 day

let cachedConfig: S3Config | null | undefined
let cachedClient: ReturnType<typeof createS3Client> | null = null

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

export async function buildFileUrlFromRegistry(
  fileRegistry?: { bucket?: string; filePath?: string },
  options: { expirySeconds?: number } = {},
): Promise<string | undefined> {
  const { expirySeconds = DEFAULT_EXPIRY_SECONDS } = options
  if (!fileRegistry?.bucket || !fileRegistry?.filePath) return undefined
  const s3 = await ensureClient()
  if (!s3) return undefined
  return await s3.getMinIOClient().presignedGetObject(
    fileRegistry.bucket,
    fileRegistry.filePath,
    expirySeconds,
  )
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
  sys: await ensureClient(),
}
