import dotenv from "dotenv";

/**
 * S3 Configuration Interface
 */
interface S3Config {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    maxsize: number;
}

/**
 * Parse S3 configuration from environment variables
 * Global S3 config is for platform internal use only
 */
function parseS3Config(): S3Config | null {
    // Try to read from S3 environment variable first (JSON format)
    const s3EnvVar = Deno.env.get('S3');
    if (s3EnvVar) {
        try {
            const s3Config = JSON.parse(s3EnvVar) as S3Config;
            // Validate the parsed config
            if (s3Config.endPoint && s3Config.accessKey && s3Config.secretKey && s3Config.bucket) {
                return {
                    endPoint: s3Config.endPoint,
                    port: s3Config.port || 9000,
                    useSSL: s3Config.useSSL !== undefined ? s3Config.useSSL : true,
                    accessKey: s3Config.accessKey,
                    secretKey: s3Config.secretKey,
                    bucket: s3Config.bucket,
                    region: s3Config.region || 'us-east-1',
                    maxsize: s3Config.maxsize || 10485760, // 10MB default
                };
            }
        } catch (error) {
            console.warn('Failed to parse S3 environment variable as JSON:', error);
        }
    }

    // Fallback to individual environment variables
    const endPoint = Deno.env.get('S3_ENDPOINT');
    const accessKey = Deno.env.get('S3_ACCESS_KEY');
    const secretKey = Deno.env.get('S3_SECRET_KEY');
    const bucket = Deno.env.get('S3_BUCKET');

    // Only return config if all required fields are present
    if (endPoint && accessKey && secretKey && bucket) {
        return {
            endPoint,
            port: parseInt(Deno.env.get('S3_PORT') || '9000'),
            useSSL: Deno.env.get('S3_USE_SSL') === 'true',
            accessKey,
            secretKey,
            bucket,
            region: Deno.env.get('S3_REGION') || 'us-east-1',
            maxsize: parseInt(Deno.env.get('S3_MAX_SIZE') || '10485760'), // 10MB
        };
    }

    // Return null if no valid S3 configuration found
    return null;
}

// Load environment variables from .env file
// In test mode, prefer .env.test over .env
const nodeEnv = Deno.env.get("NODE_ENV") ?? "development";

// If we're in test mode, try to load .env.test first, then fallback to .env
if (nodeEnv === "test") {
    // Try to load .env.test first
    const testConfig = dotenv.config({ path: ".env.test" });
    // If .env.test doesn't exist, fallback to .env
    if (testConfig.error) {
        dotenv.config();
    }
} else {
    // Normal operation - just load .env
    dotenv.config();
}

function getPositiveIntEnv(name: string, fallback: number): number {
    const raw = Deno.env.get(name);
    if (raw === undefined || raw === null || raw === "") return fallback;
    const n = parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getBooleanEnv(name: string, defaultValue: boolean): boolean {
    const raw = Deno.env.get(name);
    if (raw === undefined || raw === null) return defaultValue;
    const normalized = raw.trim().toLowerCase();
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    return defaultValue;
}

/** Origin always allowed in local/development (frontend on :3000). */
const LOCAL_FRONTEND_DEV_ORIGINS = [
    "http://localhost:3000",
] as const;

function parseCorsOrigins(nodeEnv: string): string[] {
    const raw = Deno.env.get("CORS_ORIGINS");
    const configured = raw?.trim()
        ? raw.split(",").map((origin) => origin.trim()).filter(Boolean)
        : [];

    if (nodeEnv !== "local" && nodeEnv !== "development") {
        return configured;
    }

    return [...new Set([...configured, ...LOCAL_FRONTEND_DEV_ORIGINS])];
}

// Create a function to get environment variables (called only once)
function createEnvObject() {
    const databaseUrl = Deno.env.get("DATABASE_URL") ?? "postgres://postgres:postgres@localhost:5432/ai_edu";
    const nodeEnv = Deno.env.get("NODE_ENV") ?? "development";
    
    // Only log environment variables once during initialization (if verbose logging is enabled)
    const verboseLogging = getBooleanEnv("VERBOSE_LOGGING", true);
    if (verboseLogging) {
        // Parse databaseUrl to extract host, db name, and schema
        let dbHost = "";
        let dbName = "";
        try {
            const url = new URL(databaseUrl);
            dbHost = url.hostname;
            // The pathname starts with a slash, so remove it
            dbName = url.pathname.replace(/^\//, "");
        } catch {
            // fallback if not a valid URL
            dbHost = "";
            dbName = "";
        }
        console.info("Environment initialized", { 
            DB_HOST: dbHost,
            DB_NAME: dbName,
            DB_SCHEMA: Deno.env.get("DB_SCHEMA") ?? "public",
            NODE_ENV: nodeEnv 
        });
    }
    
    return {
        PORT: Number(Deno.env.get("PORT") ?? 8000),
        HOST: Deno.env.get("HOST") ?? "0.0.0.0",
        DATABASE_URL: databaseUrl,
        NODE_ENV: nodeEnv,
        CORS_ORIGINS: parseCorsOrigins(nodeEnv),
        HTTP_LOGS: getBooleanEnv("HTTP_LOGS", true),
        DB_QUERY_LOGS: getBooleanEnv("DB_QUERY_LOGS", true),
        SECRET_KEY: Deno.env.get("SECRET_KEY") ?? "12312323232",
        VERBOSE_LOGGING: verboseLogging,
     
        // Database schema configuration
        DB_SCHEMA: Deno.env.get("DB_SCHEMA") ?? "public",
        // Global S3 configuration for platform internal use
        S3: parseS3Config(),
        DB_POOL_MAX: Number(Deno.env.get("DB_POOL_MAX") || 0) || undefined,
        INTERNAL_API_KEY: Deno.env.get("INTERNAL_API_KEY") ?? "",
        GOOGLE_API_KEY: Deno.env.get("GOOGLE_API_KEY") ?? "",
        ACCESS_TOKEN_SECRET: Deno.env.get("ACCESS_TOKEN_SECRET") ?? Deno.env.get("SECRET_KEY") ?? "change-me-access",
        REFRESH_TOKEN_SECRET: Deno.env.get("REFRESH_TOKEN_SECRET") ?? Deno.env.get("SECRET_KEY") ?? "change-me-refresh",
        ACCESS_TOKEN_LIFE_TIME: getPositiveIntEnv("ACCESS_TOKEN_LIFE_TIME", 86_400),
        REFRESH_TOKEN_LIFE_TIME: getPositiveIntEnv("REFRESH_TOKEN_LIFE_TIME", 604_800),
        TEMPORAL_ADDRESS: Deno.env.get("TEMPORAL_ADDRESS") ?? "",
        TEMPORAL_NAMESPACE: Deno.env.get("TEMPORAL_NAMESPACE") ?? "default",
        STORAGE_RAW_PREFIX: Deno.env.get("STORAGE_RAW_PREFIX") ?? "raw",
        STORAGE_SIGNED_PREFIX: Deno.env.get("STORAGE_SIGNED_PREFIX") ?? "signed",
        WATERMARK_STORAGE_PREFIX: Deno.env.get("WATERMARK_STORAGE_PREFIX") ?? "images/watermark",
        WATERMARK_IMAGE_MAX_BYTES: getPositiveIntEnv("WATERMARK_IMAGE_MAX_BYTES", 5_242_880),
        /** After stamp, rasterize each page so watermark is not separately editable/deletable. */
        WATERMARK_FLATTEN_ENABLED: getBooleanEnv("WATERMARK_FLATTEN_ENABLED", true),
        /** Flatten render DPI (72–300). Default 150. */
        WATERMARK_FLATTEN_DPI: Math.min(300, getPositiveIntEnv("WATERMARK_FLATTEN_DPI", 150)),
        /** Bucket WORM riêng cho AIP (Object Lock). Mặc định: aip-secure-bucket */
        STORAGE_AIP_BUCKET: Deno.env.get("STORAGE_AIP_BUCKET") ?? "aip-secure-bucket",
        STORAGE_AIP_PREFIX: Deno.env.get("STORAGE_AIP_PREFIX") ?? "aip",
        STORAGE_AIP_RETENTION_YEARS: getPositiveIntEnv("STORAGE_AIP_RETENTION_YEARS", 10),
        STORAGE_AIP_OBJECT_LOCK_MODE: (() => {
            const raw = (Deno.env.get("STORAGE_AIP_OBJECT_LOCK_MODE") ?? "COMPLIANCE").trim().toUpperCase();
            return raw === "GOVERNANCE" ? "GOVERNANCE" as const : "COMPLIANCE" as const;
        })(),
        KAFKA_ENABLED: getBooleanEnv("KAFKA_ENABLED", false),
        KAFKA_BROKER: Deno.env.get("KAFKA_BROKER") ?? "10.10.6.134:9092",
        KAFKA_GROUP_ID: Deno.env.get("KAFKA_GROUP_ID") ?? "sohoa-backend-group",
        KAFKA_METADATA_TOPIC: Deno.env.get("KAFKA_METADATA_TOPIC") ?? "metadata-completed",
        SCANNER_ENABLED: getBooleanEnv("SCANNER_ENABLED", false),
        SCANNER_INTERVAL_MS: getPositiveIntEnv("SCANNER_INTERVAL_MS", 10_000),
        SOCKET_ENABLED: getBooleanEnv("SOCKET_ENABLED", true),
        SOCKET_PATH: Deno.env.get("SOCKET_PATH") ?? "/socket.io",
        SMTP_HOST: Deno.env.get("SMTP_HOST") ?? "",
        SMTP_PORT: getPositiveIntEnv("SMTP_PORT", 587),
        SMTP_USER: Deno.env.get("SMTP_USER") ?? "",
        SMTP_PASSWORD: Deno.env.get("SMTP_PASSWORD") ?? "",
        SMTP_FROM: Deno.env.get("SMTP_FROM") ?? "",
        SMTP_SECURE: getBooleanEnv("SMTP_SECURE", false),
        /** Public frontend origin for absolute email deep-links (no trailing slash). */
        FRONTEND_URL: (Deno.env.get("FRONTEND_URL") ?? "").trim().replace(/\/$/, ""),
        ELASTICSEARCH_ENABLED: getBooleanEnv("ELASTICSEARCH_ENABLED", false),
        ELASTICSEARCH_URL: Deno.env.get("ELASTICSEARCH_URL") ?? "http://localhost:9200",
    } as const;
}

// Create the environment object once and cache it
const envObject = createEnvObject();

// Export the cached environment object directly (no proxy needed)
export const env = envObject;
