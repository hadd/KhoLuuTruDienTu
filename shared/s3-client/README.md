# S3 Client Library

A functional S3 helper library with MinIO SDK integration and school-based file isolation for the AI Edu platform.

## Features

- **Functional Object-Based API**: Clean functional approach without classes
- **File-Based Operations**: Uses `fPutObject`/`fGetObject` for efficient file handling
- **MinIO SDK Integration**: Direct access to all MinIO client methods
- **School-Based File Isolation**: Automatic file path organization by school and category
- **Configuration Management**: Support for global and school-specific S3 configurations
- **Presigned URLs**: Generate presigned URLs for secure file uploads and downloads
- **Error Handling**: Comprehensive error handling with custom error types
- **TypeScript Support**: Full TypeScript support with type definitions

## Installation

The library is part of the shared packages and uses Deno with npm imports for MinIO.

```typescript
import { createS3Client, createMinIOWrapper, S3ConfigService } from "@shared/s3-client";
```

## Quick Start

### Basic Usage

```typescript
import { createS3Client } from "@shared/s3-client";

// Create S3 client with configuration
const s3Client = createS3Client({
  config: {
    endPoint: "localhost",
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
    bucket: "ai-edu-platform",
    region: "us-east-1",
    maxsize: 10485760 // 10MB
  }
});

// Upload file with school context (file-based)
const uploadResult = await s3Client.uploadFile({
  bucket: "ai-edu-platform",
  objectName: "document.pdf",
  filePath: "/path/to/local/file.pdf",
  schoolId: "123",
  category: "learning-materials"
});

console.log("File uploaded:", uploadResult.url);
```

### School-Based File Isolation

Files are automatically organized by school and category:

```
schools/{schoolId}/{category}/{filename}
system/{category}/{filename}  // For system-wide files
```

Categories:
- `learning-materials` - Educational content
- `assignments` - Student assignments
- `submissions` - Student submissions
- `profile-images` - User profile pictures
- `system-files` - Platform files
- `temp` - Temporary files

### Configuration Management

```typescript
import { S3ConfigService } from "@shared/s3-client";

// Create configuration service
const configService = new S3ConfigService(globalConfig);

// Add school-specific configuration
configService.addSchoolConfig("123", {
  endPoint: "school-specific-minio.example.com",
  port: 443,
  useSSL: true,
  accessKey: "school-key",
  secretKey: "school-secret",
  bucket: "school-bucket",
  region: "us-west-2",
  maxsize: 52428800 // 50MB
});

// Get configuration for specific school
const schoolConfig = configService.getConfigForSchool("123");
```

### Presigned URLs

```typescript
// Generate presigned upload URL
const uploadUrl = await s3Client.generatePresignedUrl({
  bucket: "ai-edu-platform",
  objectName: "document.pdf",
  method: "PUT",
  schoolId: "123",
  category: "learning-materials",
  expiry: 3600 // 1 hour
});

// Generate presigned download URL
const downloadUrl = await s3Client.generatePresignedUrl({
  bucket: "ai-edu-platform",
  objectName: "document.pdf",
  method: "GET",
  schoolId: "123",
  category: "learning-materials",
  expiry: 3600
});
```

### File Operations

```typescript
// Download file (file-based)
const downloadResult = await s3Client.downloadFile({
  bucket: "ai-edu-platform",
  objectName: "document.pdf",
  filePath: "/path/to/downloaded/file.pdf",
  schoolId: "123",
  category: "learning-materials"
});

// List files
const listResult = await s3Client.listFiles({
  bucket: "ai-edu-platform",
  schoolId: "123",
  category: "learning-materials",
  maxKeys: 100
});

// Delete file
const deleteResult = await s3Client.deleteFile({
  bucket: "ai-edu-platform",
  objectName: "document.pdf",
  schoolId: "123",
  category: "learning-materials"
});

// Ensure bucket exists
await s3Client.ensureBucketExists("my-bucket");
```

## API Reference

### createS3Client()

Creates a functional S3 client object with all operations.

```typescript
const s3Client = createS3Client(options);
```

#### Methods

- `uploadFile(params: UploadParams): Promise<UploadResult>` - Upload file using fPutObject
- `downloadFile(params: DownloadParams): Promise<DownloadResult>` - Download file using fGetObject
- `deleteFile(params: DeleteParams): Promise<DeleteResult>` - Delete file from S3
- `generatePresignedUrl(params: PresignedParams): Promise<string>` - Generate presigned URLs
- `listFiles(params: ListParams): Promise<ListResult>` - List files with filtering
- `testConnection(schoolId?: string): Promise<boolean>` - Test S3 connection
- `ensureBucketExists(bucketName?: string): Promise<void>` - Ensure bucket exists
- `getConfig(schoolId?: string): S3Config` - Get configuration for school
- `getMinIOClient()` - Get direct MinIO client access
- `parseSchoolFilePath(objectName: string): SchoolFilePath | null` - Parse file paths

### createMinIOWrapper()

Creates MinIO client with additional utility methods.

```typescript
const minioClient = createMinIOWrapper(config);
```

#### Methods

All MinIO client methods plus:
- `getConfig(): S3Config` - Get configuration
- `testConnection(): Promise<boolean>` - Test connection
- `generateSchoolPath(schoolId, category, fileName): string` - Generate school paths
- `generateSystemPath(category, fileName): string` - Generate system paths
- `validateFileSize(size): boolean` - Validate file size
- `generateUrl(bucket, objectName): string` - Generate S3 URLs
- `ensureBucketExists(bucketName?): Promise<void>` - Ensure bucket exists

### S3ConfigService

Manages S3 configurations with school-specific overrides.

#### Methods

- `addSchoolConfig(schoolId: string, config: S3Config): void`
- `removeSchoolConfig(schoolId: string): void`
- `getConfigForSchool(schoolId?: string): S3Config`
- `hasSchoolConfig(schoolId: string): boolean`
- `testConfig(config: S3Config): Promise<boolean>`

## Error Handling

The library provides custom error types for different scenarios:

```typescript
import { S3Error, S3ConfigError, S3UploadError, S3DownloadError, S3DeleteError } from "@shared/s3-client";

try {
  await s3Client.uploadFile(params);
} catch (error) {
  if (error instanceof S3UploadError) {
    console.error("Upload failed:", error.message);
    console.error("S3 Error:", error.s3Error);
  } else if (error instanceof S3ConfigError) {
    console.error("Configuration error:", error.message);
  }
}
```

## Environment Variables

The library can be configured using environment variables:

```bash
S3_ENDPOINT=localhost
S3_PORT=9000
S3_USE_SSL=false
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ai-edu-platform
S3_REGION=us-east-1
S3_MAX_SIZE=10485760
```

## Integration with School Config

The library integrates with the `school_config` table for per-school S3 settings:

```typescript
// School config stored in database
{
  "schoolId": "123",
  "key": "s3",
  "value": {
    "endPoint": "school-minio.example.com",
    "port": 443,
    "useSSL": true,
    "accessKey": "school-key",
    "secretKey": "school-secret",
    "bucket": "school-bucket",
    "region": "us-west-2",
    "maxsize": 52428800
  }
}
```

## Advanced Usage

### Direct MinIO Client Access

```typescript
const s3Client = createS3Client(options);

// Get direct access to MinIO client
const minioClient = s3Client.getMinIOClient();

// Use any MinIO method directly
await minioClient.fPutObject(bucket, objectName, filePath);
await minioClient.fGetObject(bucket, objectName, filePath);
await minioClient.putObject(bucket, objectName, stream, size, metadata);
await minioClient.getObject(bucket, objectName);
```

### Environment-based Configuration

```typescript
import { createS3ClientFromEnv } from "@shared/s3-client";

const s3Client = createS3ClientFromEnv({
  S3_ENDPOINT: "localhost",
  S3_PORT: "9000",
  S3_USE_SSL: "false",
  S3_ACCESS_KEY: "minioadmin",
  S3_SECRET_KEY: "minioadmin",
  S3_BUCKET: "ai-edu-platform",
  S3_REGION: "us-east-1",
  S3_MAX_SIZE: "10485760"
});
```

### File Path Parsing

```typescript
const parsed = s3Client.parseSchoolFilePath("schools/123/learning-materials/document.pdf");
// Returns: { schoolId: "123", category: "learning-materials", fileName: "document.pdf", objectKey: "..." }

const systemParsed = s3Client.parseSchoolFilePath("system/profile-images/avatar.png");
// Returns: { schoolId: "system", category: "profile-images", fileName: "avatar.png", objectKey: "..." }
```

## Type Definitions

### UploadParams
```typescript
interface UploadParams {
  bucket: string;
  objectName: string;
  filePath: string;        // Local file path for fPutObject
  contentType?: string;
  metadata?: Record<string, string>;
  schoolId?: string;
  category?: string;
}
```

### DownloadParams
```typescript
interface DownloadParams {
  bucket: string;
  objectName: string;
  filePath: string;        // Local file path for fGetObject
  schoolId?: string;
}
```

## License

Part of the AI Edu platform shared libraries.
