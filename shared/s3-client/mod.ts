// Core S3 Client
export { createS3Client, createS3ClientFromEnv } from "./s3-client.ts";

// MinIO Wrapper
export { createMinIOWrapper, MinIOWrapper } from "./minio-wrapper.ts";

// Configuration Service
export { S3ConfigService } from "./s3-config.ts";

// Helper Utilities
export {
  sanitizeName,
  generateTimestampPath,
  generatePublicAssetPath,
  getMimeTypeFromFilename,
} from "./s3-helper.ts";

// Types and Interfaces
export type {
  S3Config,
  UploadParams,
  UploadResult,
  DownloadParams,
  DownloadResult,
  DeleteParams,
  DeleteResult,
  PresignedParams,
  PresignedPostParams,
  PresignedPostResult,
  ListParams,
  ListResult,
  FileInfo,
  FileCategory,
  S3ClientOptions,
  MinIOInstanceKey,
  GlobalS3Config,
  FileMetadata
} from "./types.ts";

export {
  DEFAULT_S3_CONFIG,
  FILE_CATEGORIES,
  S3Error,
  S3ConfigError,
  S3UploadError,
  S3DownloadError,
  S3DeleteError
} from "./types.ts";

// Re-export commonly used types for convenience
