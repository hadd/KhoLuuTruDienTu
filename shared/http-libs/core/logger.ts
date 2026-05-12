import { Elysia } from "elysia";
import { logApi } from "@shared/common-lib";

export interface LoggerPluginOptions {
    name?: string;
    pretty?: boolean;
    logErrors?: boolean;
    enabled?: boolean;
    includeStack?: boolean;
}

interface RequestWithMetadata extends Request {
    __requestId?: string;
    __startTime?: number;
}

function formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
}

function extractErrorMessage(error: unknown, status: number): string {
    if (400 <= status && status < 500) {
        if (error && typeof (error as any).summary === "string") {
            return (error as any).summary;
        }
        if (error && typeof (error as any).message === "string") {
            try {
                const parsed = JSON.parse((error as any).message);
                return parsed?.summary || (error as any).message;
            } catch {
                return (error as any).message;
            }
        }
    } else {
        if (error && typeof (error as any).message === "string") {
            return (error as any).message;
        }
    }
    return String(error);
}

export function loggerPlugin(opts: LoggerPluginOptions = {}) {
    const logErrors = opts.logErrors ?? true;
    const enabled = opts.enabled ?? true;
    const includeStack = opts.includeStack ?? true;

    if (!enabled) {
        return new Elysia({ name: "logger-plugin" });
    }

    return new Elysia({ name: "logger-plugin" })
        .onRequest(({ request }) => {
            const requestId = generateRequestId();
            const startTime = performance.now();
            
            const reqWithMeta = request as RequestWithMetadata;
            reqWithMeta.__requestId = requestId;
            reqWithMeta.__startTime = startTime;
        })
        .onAfterHandle({as :"global"},({ request, set, responseValue }) => {
            const url = new URL(request.url);
            const status = typeof set.status === "number" ? set.status : 200;
            const reqWithMeta = request as RequestWithMetadata;
            const startTime = reqWithMeta.__startTime;
            const duration = startTime ? performance.now() - startTime : 0;
            const durationStr = formatDuration(duration);
           
            if (status >= 400) {
                const resAny = responseValue as { summary?: string; message?: string } | undefined;
                const msg = resAny?.summary ?? resAny?.message ?? String(resAny ?? "");
                const level = status >= 500 ? "error" : "warn";
                logApi[level]({
                    method: request.method,
                    path: url.pathname,
                    status,
                    duration: durationStr,
                    error: msg,
                }, `[${reqWithMeta.__requestId}] ${request.method} ${url.pathname} ${status} ${durationStr}`);
            } else {
                logApi(`${request.method} ${url.pathname} ${status} ${durationStr}`);
            }
        })
        .onError({as : "global"},({ error, request, set: _set }) => {
            if (!logErrors) return;
            
            const url = new URL(request.url);
            const errorStatus = error && typeof (error as any).status === "number" ? (error as any).status : undefined;
            const status = errorStatus || 500;
            const reqWithMeta = request as RequestWithMetadata;
            const startTime = reqWithMeta.__startTime;
            const duration = startTime ? performance.now() - startTime : 0;
            const durationStr = formatDuration(duration);
            
            const errorMsg = extractErrorMessage(error, status);
            const level = status >= 500 ? "error" : "warn";

            logApi[level]({
                method: request.method,
                path: url.pathname,
                status,
                duration: durationStr,
                error: errorMsg,
                ...(status >= 500 && includeStack && error instanceof Error && error.stack ? { stack: error.stack } : {}),
            }, `[${reqWithMeta.__requestId}] ${request.method} ${url.pathname} ${status} ${durationStr}`);
        });
}


