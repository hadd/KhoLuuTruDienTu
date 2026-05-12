import { AppError } from "@shared/common-lib";
import { DrizzleQueryError } from "drizzle-orm/errors"

export interface ErrorPluginOptions {
    enabled?: boolean;
}

const isDev = Deno.env.get("NODE_ENV") === "development" || Deno.env.get("NODE_ENV") === "test";
export function createOnErrorHandler() {
    return ({ error }: { error: unknown }) => {
        if (error instanceof AppError) {
            // set.status = error.status;
            return {
                error: error.details ?? error.message,
                code: error.code,
                status: error.status,
            };
        }

        if (error instanceof DrizzleQueryError) {
            // Handle the DrizzleQueryError
            
            console.error("Original Error Cause:", error.cause?.message);
            return {
                error: isDev ? error.cause?.message : "Database query error",
                code: "INTERNAL_SERVER_ERROR",
                status: 500,
            }
        }

        const message = (error && typeof (error as any).message === "string")
            ? (error as any).message as string
            : "Internal Server Error";
        if ((error as any).status >= 400 && (error as any).status < 500) {
            let errorDetail = (error as any).details ?? (error as any).message;
            let message = (error as any).message;
            const errorWithStatus = error as { status?: number };
            if(errorWithStatus.status ===422){
                errorDetail = JSON.parse(errorDetail) as any;
                message= errorDetail.summary;
            }
            return {
                error: errorDetail,
                code: (error as any).code,
                message,
                status: (error as any).status,
            };
        }
        return {
            error: message,
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
        };
    };
}


