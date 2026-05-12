/**
 * MinIO Wrapper
 * 
 * Extends MinIO client with additional utility methods.
 * Returns spread of MinIO client + custom methods.
 */

import { Client as MinioClient } from "minio";
import { S3Config, S3ConfigError } from "./types.ts";

/**
 * Create MinIO client with additional utility methods
 * 
 * Returns: {...minioClient, customMethod1, customMethod2, ...}
 */
export function createMinIOWrapper(config: S3Config) {
  // Validate configuration
  if (!config.endPoint) {
    throw new S3ConfigError("endPoint is required");
  }
  if (!config.accessKey) {
    throw new S3ConfigError("accessKey is required");
  }
  if (!config.secretKey) {
    throw new S3ConfigError("secretKey is required");
  }
  if (!config.bucket) {
    throw new S3ConfigError("bucket is required");
  }

  // Create MinIO client
  const minioClient = new MinioClient({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: config.region,
  });

  // Return MinIO client with additional methods
  return Object.assign(minioClient, {
    // Additional utility methods
    getConfig: () => ({ ...config }),
    
    async testConnection(): Promise<boolean> {
      try {
        await minioClient.listBuckets();
        return true;
      } catch {
        return false;
      }
    },

    // File size validation
    validateFileSize(size: number): boolean {
      return size <= config.maxsize;
    },

    // Generate S3 URL
    generateUrl(bucket: string, objectName: string): string {
      const protocol = config.useSSL ? 'https' : 'http';
      const port = (config.useSSL && config.port === 443) || (!config.useSSL && config.port === 80) 
        ? '' 
        : `:${config.port}`;
      
      return `${protocol}://${config.endPoint}${port}/${bucket}/${objectName}`;
    },

    // Ensure bucket exists, create if it doesn't
    async ensureBucketExists(bucketName?: string): Promise<string|undefined> {
      const bucket = bucketName || config.bucket;
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket, config.region);
      }
      return bucket;
    }
  } as typeof minioClient & {
    getConfig: () => S3Config;
    testConnection(): Promise<boolean>;
    validateFileSize(size: number): boolean;
    generateUrl(bucket: string, objectName: string): string;
    ensureBucketExists(bucketName?: string): Promise<string|undefined>;
  });
}

/**
 * Legacy class wrapper for backward compatibility
 * @deprecated Use createMinIOWrapper() instead
 */
export class MinIOWrapper {
  public client: MinioClient;
  public config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    this.validateConfig(config);
    this.client = this.createClient(config);
  }

  private validateConfig(config: S3Config): void {
    if (!config.endPoint) {
      throw new S3ConfigError("endPoint is required");
    }
    if (!config.accessKey) {
      throw new S3ConfigError("accessKey is required");
    }
    if (!config.secretKey) {
      throw new S3ConfigError("secretKey is required");
    }
    if (!config.bucket) {
      throw new S3ConfigError("bucket is required");
    }
  }

  private createClient(config: S3Config): MinioClient {
    return new MinioClient({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
  }

  getConfig(): S3Config {
    return { ...this.config };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  async ensureBucketExists(bucketName?: string): Promise<void> {
    const bucket = bucketName || this.config.bucket;
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, this.config.region);
    }
  }
}
