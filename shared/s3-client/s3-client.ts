import {createMinIOWrapper} from "./minio-wrapper.ts";
import {S3ConfigService} from "./s3-config.ts";
import {
    S3ClientOptions,
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
    S3Config,
    S3Error,
    S3UploadError,
    S3DownloadError,
    S3DeleteError
} from "./types.ts";


export function createS3Client(options: S3ClientOptions) {
    const configService = new S3ConfigService(options.config);
    const globalConfig = configService.getGlobalConfig();
    const minioClient = createMinIOWrapper(globalConfig);

    // Helper functions
    const resolveObjectName = (objectName?: string): string => {
        return objectName || 'file';
    };

    const resolvePrefix = (params: ListParams): string => {
        return params.prefix || '';
    };

    const generateS3Url = (bucket: string, objectName: string): string => {
        const config = configService.getGlobalConfig();
        const protocol = config.useSSL ? 'https' : 'http';
        const port = (config.useSSL && config.port === 443) || (!config.useSSL && config.port === 80)
            ? ''
            : `:${config.port}`;

        return `${protocol}://${config.endPoint}${port}/${bucket}/${objectName}`;
    };

    const _getMaxFileSize = (): number => {
        const config = configService.getGlobalConfig();
        return config.maxsize;
    };

    // Return S3 client object
    return {
        // Upload file to S3 using fputObject
        async uploadFile(params: UploadParams): Promise<UploadResult> {
            try {
                // Ensure bucket exists
                await minioClient.ensureBucketExists(params.bucket);

                // Use provided object key
                const objectName = resolveObjectName(params.objectName);

                // Prepare metadata
                const metadata: Record<string, string> = {
                    'uploaded-at': new Date().toISOString(),
                    ...params.metadata
                };

                // Upload to S3 using fPutObject (file-based upload)
                await minioClient.fPutObject(
                    params.bucket,
                    objectName,
                    params.filePath,
                    metadata
                );

                // fPutObject returns void, so we'll generate a simple etag based on the file
                const etag = `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`;

                // Get file stats for size
                const stats = await Deno.stat(params.filePath);
                const fileSize = stats.size;

                // Generate S3 URL
                const url = generateS3Url(params.bucket, objectName);

                return {
                    objectName,
                    bucket: params.bucket,
                    etag,
                    size: fileSize,
                    uploadedAt: new Date(),
                    url
                };
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3UploadError(
                    `Failed to upload file: ${errorMessage}`,
                    error
                );
            }
        },

        // Download file from S3 using fgetObject
        async downloadFile(params: DownloadParams): Promise<DownloadResult> {
            try {
                // Use provided object key
                const objectName = resolveObjectName(params.objectName);

                // Download from S3 using fGetObject (file-based download)
                await minioClient.fGetObject(
                    params.bucket,
                    objectName,
                    params.filePath
                );

                // Get object metadata
                const stat = await minioClient.statObject(
                    params.bucket,
                    objectName
                );

                return {
                    filePath: params.filePath,
                    size: stat.size,
                    contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
                    lastModified: stat.lastModified,
                    etag: stat.etag
                };
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3DownloadError(
                    `Failed to download file: ${errorMessage}`,
                    error
                );
            }
        },

        // Delete file from S3
        async deleteFile(params: DeleteParams): Promise<DeleteResult> {
            try {
                // Use provided object key
                const objectName = resolveObjectName(params.objectName);

                // Delete from S3
                await minioClient.removeObject(params.bucket, objectName);

                return {
                    objectName,
                    bucket: params.bucket,
                    deletedAt: new Date()
                };
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3DeleteError(
                    `Failed to delete file: ${errorMessage}`,
                    error
                );
            }
        },

        // Generate presigned URL for file operations
        async generatePresignedUrl(params: PresignedParams): Promise<string> {
            try {
                // Use provided object key
                const objectName = resolveObjectName(params.objectName);

                // Generate presigned URL
                if (params.method === 'PUT') {
                    return await minioClient.presignedPutObject(
                        params.bucket,
                        objectName,
                        params.expiry || 3600
                    );
                } else {
                    return await minioClient.presignedGetObject(
                        params.bucket,
                        objectName,
                        params.expiry || 3600
                    );
                }
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3Error(
                    `Failed to generate presigned URL: ${errorMessage}`,
                    'PRESIGNED_URL_ERROR',
                    500,
                    error
                );
            }
        },

        async generatePresignedPostPolicy(params: PresignedPostParams): Promise<PresignedPostResult> {
            try {
                const prefix = params.prefix.endsWith("/") ? params.prefix : `${params.prefix}/`;
                const maxSize = params.maxFileSize ?? _getMaxFileSize();
                const minSize = params.minFileSize ?? 0;

                const policy = minioClient.newPostPolicy();
                policy.setBucket(params.bucket);
                policy.setKeyStartsWith(prefix);
                const expires = new Date();
                expires.setTime(expires.getTime() + (params.expiry ?? 3600) * 1000);
                policy.setExpires(expires);
                policy.setContentLengthRange(minSize, maxSize);
                if (params.contentTypePrefix) {
                    policy.setContentTypeStartsWith(params.contentTypePrefix);
                }

                const { postURL, formData } = await minioClient.presignedPostPolicy(policy);
                return {
                    postURL,
                    formData: formData as Record<string, string>,
                    prefix,
                };
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3Error(
                    `Failed to generate presigned POST policy: ${errorMessage}`,
                    "PRESIGNED_POST_ERROR",
                    500,
                    error
                );
            }
        },

        // List files in S3 bucket
        async listFiles(params: ListParams): Promise<ListResult> {
            const prefix = resolvePrefix(params);
            const maxKeys = params.maxKeys || 1000;

            // listObjects returns a Node.js EventEmitter stream. Errors thrown
            // inside the XML-parser transform (e.g. fast-xml-parser's "Entity
            // expansion limit exceeded") surface only via the 'error' event and
            // are NOT caught by a for-await loop, causing an uncaught exception
            // that kills the process. Wrapping in a Promise + .on('error')
            // captures them safely and converts them into normal rejections.
            return await new Promise<ListResult>((resolve, reject) => {
                const stream = minioClient.listObjects(
                    params.bucket,
                    prefix,
                    true
                );

                const files: FileInfo[] = [];
                let count = 0;
                let settled = false;

                const done = (result: ListResult) => {
                    if (settled) return;
                    settled = true;
                    resolve(result);
                };

                const fail = (error: unknown) => {
                    if (settled) return;
                    settled = true;
                    if (error instanceof S3Error) {
                        reject(error);
                        return;
                    }
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    reject(new S3Error(
                        `Failed to list files: ${errorMessage}`,
                        'LIST_ERROR',
                        500,
                        error
                    ));
                };

                stream.on('data', (obj) => {
                    if (settled || count >= maxKeys) return;

                    // Optional category filter retained for backward compatibility
                    if (params.category && !obj.name?.includes(`/${params.category}/`)) return;

                    files.push({
                        objectName: obj.name,
                        size: obj.size,
                        lastModified: obj.lastModified,
                        etag: obj.etag,
                        contentType: obj.metaData?.['content-type'],
                        metadata: obj.metaData,
                        url: generateS3Url(params.bucket, obj.name)
                    });

                    count++;

                    if (count >= maxKeys) {
                        stream.destroy();
                        done({ files, isTruncated: true, totalCount: files.length });
                    }
                });

                stream.on('end', () => {
                    done({ files, isTruncated: false, totalCount: files.length });
                });

                stream.on('error', fail);
            });
        },

        // Get current configuration
        getConfig(): S3Config {
            return configService.getGlobalConfig();
        },

        // Test connection to S3 service
        async testConnection(): Promise<boolean> {
            return await minioClient.testConnection();
        },

        // Get MinIO client instance
        getMinIOClient() {
            return minioClient;
        },
        async ensureBucketExists(bucketName?: string): Promise<string | undefined> {
            return await minioClient.ensureBucketExists(bucketName);
        },

        async isPrefixPublic(params: { bucket: string; prefix: string }): Promise<boolean> {
            try {
                const policyStr = await minioClient.getBucketPolicy(params.bucket);
                if (!policyStr) return false;

                const policy = JSON.parse(policyStr);
                if (!policy.Statement || !Array.isArray(policy.Statement)) {
                    return false;
                }

                const prefixResource = `arn:aws:s3:::${params.bucket}/${params.prefix}/*`;
                
                return policy.Statement.some((stmt: any) => {
                    if (stmt.Effect !== "Allow") return false;
                    if (stmt.Principal !== "*" && stmt.Principal?.AWS !== "*") return false;
                    
                    const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
                    if (!actions.some((action: string) => action === "s3:GetObject" || action === "*")) {
                        return false;
                    }
                    
                    const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
                    return resources.some((resource: string) => resource === prefixResource);
                });
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                return false;
            }
        },

        async ensurePrefixPublic(params: { bucket: string; prefix: string }): Promise<void> {
            try {
                const isPublic = await this.isPrefixPublic(params);
                if (isPublic) {
                    return;
                }

                let existingPolicy: any = {
                    Version: "2012-10-17",
                    Statement: []
                };

                try {
                    const policyStr = await minioClient.getBucketPolicy(params.bucket);
                    if (policyStr) {
                        existingPolicy = JSON.parse(policyStr);
                        if (!existingPolicy.Statement || !Array.isArray(existingPolicy.Statement)) {
                            existingPolicy.Statement = [];
                        }
                    }
                } catch {
                    existingPolicy = {
                        Version: "2012-10-17",
                        Statement: []
                    };
                }

                const prefixResource = `arn:aws:s3:::${params.bucket}/${params.prefix}/*`;
                
                const hasPrefixStatement = existingPolicy.Statement.some((stmt: any) => {
                    const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
                    return resources.some((resource: string) => resource === prefixResource);
                });

                if (!hasPrefixStatement) {
                    existingPolicy.Statement.push({
                        Effect: "Allow",
                        Principal: "*",
                        Action: "s3:GetObject",
                        Resource: prefixResource
                    });
                }

                await minioClient.setBucketPolicy(params.bucket, JSON.stringify(existingPolicy));
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3Error(
                    `Failed to ensure prefix is public: ${errorMessage}`,
                    'SET_POLICY_ERROR',
                    500,
                    error
                );
            }
        },

        async setObjectPublic(params: { bucket: string; objectName: string }): Promise<void> {
            try {
                await this.ensurePrefixPublic({
                    bucket: params.bucket,
                    prefix: "public-asset"
                });
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3Error(
                    `Failed to set object as public: ${errorMessage}`,
                    'SET_ACL_ERROR',
                    500,
                    error
                );
            }
        },

        generatePublicUrl(bucket: string, objectName: string): string {
            return generateS3Url(bucket, objectName);
        },

        async ensureTempPrefixPublic(params: { bucket: string }): Promise<void> {
            try {
                await this.ensurePrefixPublic({
                    bucket: params.bucket,
                    prefix: "temp"
                });
            } catch (error) {
                if (error instanceof S3Error) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new S3Error(
                    `Failed to ensure temp prefix is public: ${errorMessage}`,
                    'SET_POLICY_ERROR',
                    500,
                    error
                );
            }
        }
    };
}

/**
 * Factory function to create S3Client from environment variables
 */
export function createS3ClientFromEnv(env: Record<string, string | undefined>) {
    const config = S3ConfigService.fromEnvironment(env);
    return createS3Client({config});
}
