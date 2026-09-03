import { env } from "../../env.ts";
import { httpError, logApi } from "@shared/common-lib";

let dbInstance: any = null;
let connInstance: any = null;
let isConfigured = false;

/**
 * Khởi tạo & lấy DuckDB WASM Connection Singleton cho process backend Deno.
 */
async function getDuckDbConnection(): Promise<any> {
    if (connInstance && isConfigured) {
        return connInstance;
    }

    const s3 = env.S3;
    if (!s3) {
        throw httpError.serviceUnavailable("Cấu hình S3 chưa được thiết lập trong env.");
    }

    try {
        if (!connInstance) {
            const duckdbWasm = await import("npm:@duckdb/duckdb-wasm@^1.32.0");
            const BUNDLES = duckdbWasm.getJsDelivrBundles();
            const bundle = await duckdbWasm.selectBundle(BUNDLES);
            
            const logger = new duckdbWasm.ConsoleLogger();
            const worker = new Worker(bundle.mainWorker!, { type: "module" });
            dbInstance = new duckdbWasm.AsyncDuckDB(logger, worker);
            await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker);
            connInstance = await dbInstance.connect();
        }

        if (!isConfigured) {
            await connInstance.query("INSTALL httpfs; LOAD httpfs;");

            const useSsl = s3.useSSL ? "true" : "false";
            await connInstance.query(`
                SET s3_endpoint='${s3.endPoint}:${s3.port}';
                SET s3_use_ssl=${useSsl};
                SET s3_url_style='path';
                SET s3_access_key_id='${s3.accessKey}';
                SET s3_secret_access_key='${s3.secretKey}';
            `);
            isConfigured = true;
            logApi.info("[DuckDB WASM] S3/MinIO httpfs configuration loaded successfully.");
        }

        return connInstance;
    } catch (err: any) {
        logApi.error({ err }, "[DuckDB WASM] Failed to initialize DuckDB connection");
        throw httpError.serviceUnavailable(`DuckDB initialization error: ${err.message}`);
    }
}

/**
 * Thực thi câu truy vấn SQL trên DuckDB WASM async.
 */
export async function queryDuckDb<T = any>(sql: string): Promise<T[]> {
    const conn = await getDuckDbConnection();
    const result = await conn.query(sql);
    return result.toArray().map((row: any) => row.toJSON()) as T[];
}
