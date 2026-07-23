/**
 * S3 Client Types and Interfaces
 * 
 * Type definitions for the S3 helper library with MinIO SDK integration.
 */

// ReadableStream is available globally in Deno

/**
 * S3 Configuration Interface
 * Compatible with MinIO, AWS S3, and other S3-compatible services
 */
export interface S3Config {
  /** S3 endpoint URL (required) */
  endPoint: string;
  /** Port number (default: 9000 for MinIO, 443 for AWS S3) */
  port: number;
  /** Use SSL/TLS (default: true) */
  useSSL: boolean;
  /** Access key (required) */
  accessKey: string;
  /** Secret key (required) */
  secretKey: string;
  /** Default bucket name (required) */
  bucket: string;
  /** AWS region (default: us-east-1) */
  region: string;
  /** Maximum file size in bytes (default: 10MB) */
  maxsize: number;
}

/**
 * Default S3 Configuration
 */
export const DEFAULT_S3_CONFIG: Partial<S3Config> = {
  port: 9000,
  useSSL: true,
  region: "us-east-1",
  maxsize: 10485760, // 10MB
};

/**
 * Upload Parameters
 */
export interface UploadParams {
  /** S3 bucket name */
  bucket: string;
  /** Object key (file path) */
  objectName: string;
  /** File path for fputObject */
  filePath: string;
  /** MIME type */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** File category for organization */
  category?: string;
}

/**
 * Upload Result
 */
export interface UploadResult {
  /** S3 object key (file path) */
  objectName: string;
  /** S3 bucket name */
  bucket: string;
  /** ETag from S3 */
  etag: string;
  /** File size in bytes */
  size: number;
  /** Upload timestamp */
  uploadedAt: Date;
  /** Full S3 URL */
  url: string;
}

/**
 * Download Parameters
 */
export interface DownloadParams {
  /** S3 bucket name */
  bucket: string;
  /** Object key (file path) */
  objectName: string;
  /** Local file path for fgetObject */
  filePath: string;
}

/**
 * Download Result
 */
export interface DownloadResult {
  /** Local file path where file was downloaded */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Content type */
  contentType: string;
  /** Last modified date */
  lastModified: Date;
  /** ETag */
  etag: string;
}

/**
 * Delete Parameters
 */
export interface DeleteParams {
  /** S3 bucket name */
  bucket: string;
  /** Object key (file path) */
  objectName: string;
}

/**
 * Delete Result
 */
export interface DeleteResult {
  /** Object key that was deleted */
  objectName: string;
  /** S3 bucket name */
  bucket: string;
  /** Deletion timestamp */
  deletedAt: Date;
}

/**
 * Presigned POST Policy Parameters (prefix-based, allows multiple files per policy)
 */
export interface PresignedPostParams {
  /** S3 bucket name */
  bucket: string;
  /** Key prefix - uploads allowed for any key starting with this (e.g. "temp/") */
  prefix: string;
  /** Expiry time in seconds (default: 3600 = 1 hour) */
  expiry?: number;
  /** Max file size in bytes (default: from config maxsize) */
  maxFileSize?: number;
  /** Min file size in bytes (default: 0) */
  minFileSize?: number;
  /** Content-Type prefix, e.g. "image/" allows any image (optional) */
  contentTypePrefix?: string;
  /** Custom user metadata (e.g. { "run-mode": "manual" }) stored on the uploaded object as x-amz-meta-* */
  userMetaData?: Record<string, string>;
}

/**
 * Presigned POST Policy Result - client POSTs each file with key = prefix + filename
 */
export interface PresignedPostResult {
  /** URL to POST multipart/form-data */
  postURL: string;
  /** Form fields to include (policy, x-amz-signature, x-amz-credential, key, etc.) */
  formData: Record<string, string>;
  /** Key prefix - client sets key = prefix + filename for each file */
  prefix: string;
}

/**
 * Presigned URL Parameters
 */
export interface PresignedParams {
  /** S3 bucket name */
  bucket: string;
  /** Object key (file path) */
  objectName: string;
  /** Expiry time in seconds (default: 3600 = 1 hour) */
  expiry?: number;
  /** HTTP method (default: 'GET') */
  method?: 'GET' | 'PUT' | 'POST';
}

/**
 * List Parameters
 */
export interface ListParams {
  /** S3 bucket name */
  bucket: string;
  /** Prefix to filter objects */
  prefix?: string;
  /** Maximum number of objects to return */
  maxKeys?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** File category filter */
  category?: string;
}

/**
 * File Information
 */
export interface FileInfo {
  /** Object key (file path) */
  objectName: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
  /** ETag */
  etag: string;
  /** Content type */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Full S3 URL */
  url: string;
}

/**
 * List Result
 */
export interface ListResult {
  /** Array of file information */
  files: FileInfo[];
  /** Whether there are more files to list */
  isTruncated: boolean;
  /** Continuation token for next page */
  nextContinuationToken?: string;
  /** Total number of files */
  totalCount: number;
}

/**
 * S3 Client Options
 */
export interface S3ClientOptions {
  /** S3 configuration */
  config: S3Config;
  /** Enable debug logging */
  debug?: boolean;
  /** Default bucket name */
  defaultBucket?: string;
}

/**
 * MinIO Instance Map Key
 */
export type MinIOInstanceKey = string;

/**
 * File Categories
 */
export const FILE_CATEGORIES = {
  LEARNING_MATERIALS: 'learning-materials',
  ASSIGNMENTS: 'assignments',
  SUBMISSIONS: 'submissions',
  PROFILE_IMAGES: 'profile-images',
  SYSTEM_FILES: 'system-files',
  TEMP: 'temp',
} as const;

export type FileCategory = typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES];

/**
 * Global S3 Configuration
 */
export interface GlobalS3Config {
  s3: S3Config;
}

/**
 * File Metadata Interface
 */
export interface FileMetadata {
  originalName?: string;
  checksum?: string;
  width?: number;
  height?: number;
  tags?: string[];
  custom?: Record<string, string | number | boolean | object>;
}

/**
 * S3 Error Types
 */
export class S3Error extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public s3Error?: any
  ) {
    super(message);
    this.name = 'S3Error';
  }
}

export class S3ConfigError extends S3Error {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'S3ConfigError';
  }
}

export class S3UploadError extends S3Error {
  constructor(message: string, s3Error?: any) {
    super(message, 'UPLOAD_ERROR', 500, s3Error);
    this.name = 'S3UploadError';
  }
}

export class S3DownloadError extends S3Error {
  constructor(message: string, s3Error?: any) {
    super(message, 'DOWNLOAD_ERROR', 404, s3Error);
    this.name = 'S3DownloadError';
  }
}

export class S3DeleteError extends S3Error {
  constructor(message: string, s3Error?: any) {
    super(message, 'DELETE_ERROR', 500, s3Error);
    this.name = 'S3DeleteError';
  }
}
