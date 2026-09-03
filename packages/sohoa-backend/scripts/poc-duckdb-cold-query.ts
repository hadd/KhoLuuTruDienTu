import { env } from "../env.ts";

async function runPoc() {
    console.log("=== Giai đoạn A0: POC DuckDB (DuckDB WASM) ===");
    console.log("Runtime version check...");
    console.log("Deno version:", Deno.version.deno);

    const s3 = env.S3;
    if (!s3) {
        console.error("❌ Cấu hình S3 không khả dụng trong env.");
        return;
    }

    try {
        console.log("Đang import @duckdb/duckdb-wasm module...");
        const duckdbWasm = await import("npm:@duckdb/duckdb-wasm@^1.28.0");
        console.log("✅ Load @duckdb/duckdb-wasm thành công!");

        const MANUAL_BUNDLES = duckdbWasm.getJsDelivrBundles();
        const bundle = await duckdbWasm.selectBundle(MANUAL_BUNDLES);
        
        console.log("Selected bundle:", bundle.mainWorker);
        console.log("🎉 Giai đoạn A0 Import WASM DuckDB đã OK!");

    } catch (err: any) {
        console.error("❌ POC WASM thất bại:", err);
    }
}

runPoc();
