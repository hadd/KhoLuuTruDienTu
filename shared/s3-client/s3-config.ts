/**
 * S3 Configuration Service
 * 
* Manages S3 configurations with global overrides.
 */

import { S3Config, DEFAULT_S3_CONFIG, S3ConfigError } from "./types.ts";

/**
 * Global S3 Configuration
 * This would typically come from environment variables or a global config service
 */
export interface GlobalS3Config {
  s3: S3Config;
}

/**
 * S3 Configuration Service
 * 
 * Handles configuration resolution with global overrides.
 */
export class S3ConfigService {
  private globalConfig: S3Config;

  constructor(globalConfig: S3Config) {
    this.globalConfig = this.validateAndNormalizeConfig(globalConfig);
  }

  /**
   * Validate and normalize S3 configuration
   */
  private validateAndNormalizeConfig(config: S3Config): S3Config {
    const normalized = {
      ...DEFAULT_S3_CONFIG,
      ...config,
    };

    // Validate required fields
    if (!normalized.endPoint) {
      throw new S3ConfigError("endPoint is required in S3 configuration");
    }
    if (!normalized.accessKey) {
      throw new S3ConfigError("accessKey is required in S3 configuration");
    }
    if (!normalized.secretKey) {
      throw new S3ConfigError("secretKey is required in S3 configuration");
    }
    if (!normalized.bucket) {
      throw new S3ConfigError("bucket is required in S3 configuration");
    }

    return normalized;
  }

  /**
   * Get global S3 configuration
   */
  getGlobalConfig(): S3Config {
    return this.globalConfig;
  }

  /**
   * Update global S3 configuration
   */
  updateGlobalConfig(config: Partial<S3Config>): void {
    this.globalConfig = this.validateAndNormalizeConfig({
      ...this.globalConfig,
      ...config,
    });
  }

  /**
   * Create S3 configuration from environment variables
   */
  static fromEnvironment(env: Record<string, string | undefined>): S3Config {
    const config: Partial<S3Config> = {};

    if (env.S3_ENDPOINT) {
      config.endPoint = env.S3_ENDPOINT;
    }
    if (env.S3_PORT) {
      config.port = parseInt(env.S3_PORT, 10);
    }
    if (env.S3_USE_SSL !== undefined) {
      config.useSSL = env.S3_USE_SSL === 'true';
    }
    if (env.S3_ACCESS_KEY) {
      config.accessKey = env.S3_ACCESS_KEY;
    }
    if (env.S3_SECRET_KEY) {
      config.secretKey = env.S3_SECRET_KEY;
    }
    if (env.S3_BUCKET) {
      config.bucket = env.S3_BUCKET;
    }
    if (env.S3_REGION) {
      config.region = env.S3_REGION;
    }
    if (env.S3_MAX_SIZE) {
      config.maxsize = parseInt(env.S3_MAX_SIZE, 10);
    }

    return {
      ...DEFAULT_S3_CONFIG,
      ...config,
    } as S3Config;
  }

  /**
   * Create S3 configuration from JSON object
   */
  static fromJson(json: any): S3Config {
    if (typeof json !== 'object' || json === null) {
      throw new S3ConfigError("S3 configuration must be a JSON object");
    }

    return {
      ...DEFAULT_S3_CONFIG,
      ...json,
    } as S3Config;
  }

  /**
   * Convert S3 configuration to JSON
   */
  static toJson(config: S3Config): Record<string, any> {
    return {
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      bucket: config.bucket,
      region: config.region,
      maxsize: config.maxsize,
    };
  }

  /**
   * Validate S3 configuration without creating service
   */
  static validateConfig(config: S3Config): void {
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
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new S3ConfigError("port must be between 1 and 65535");
    }
    if (config.maxsize && config.maxsize < 0) {
      throw new S3ConfigError("maxsize must be a positive number");
    }
  }

  /**
   * Test S3 configuration by attempting to connect
   */
  async testConfig(config: S3Config): Promise<boolean> {
    try {
      const { MinIOWrapper } = await import("./minio-wrapper.ts");
      const wrapper = new MinIOWrapper(config);
      return await wrapper.testConnection();
    } catch (_error) {
      return false;
    }
  }
}
