import { Logger } from "@std/log";

const logger = new Logger("http-error", "INFO");

export class AppError extends Error {
    status: number;
    code: string;
    details?: unknown;
    correlationId?: string;
    timestamp: string;

    constructor(status: number, code: string, message: string, details?: unknown, correlationId?: string) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.correlationId = correlationId;
        this.timestamp = new Date().toISOString();

        logger.error(`AppError: ${code}`, {
            status,
            message,
            details,
            correlationId,
            stack: this.stack,
        });
    }
}

export const httpError = {
    badRequest(message = "Bad Request", details?: unknown) {
        return new AppError(400, "BAD_REQUEST", message, details);
    },
    unauthorized(message = "Unauthorized", details?: unknown) {
        return new AppError(401, "UNAUTHORIZED", message, details);
    },
    forbidden(message = "Forbidden", details?: unknown) {
        return new AppError(403, "FORBIDDEN", message, details);
    },
    notFound(message = "Not Found", details?: unknown) {
        return new AppError(404, "NOT_FOUND", message, details);
    },
    conflict(message = "Conflict", details?: unknown) {
        return new AppError(409, "CONFLICT", message, details);
    },
    unprocessableEntity(message = "Unprocessable Entity", details?: unknown) {
        return new AppError(422, "UNPROCESSABLE_ENTITY", message, details);
    },
    validationError(message = "Validation Error", details?: unknown) {
        return new AppError(422, "VALIDATION_ERROR", message, details);
    },
    rateLimit(message = "Rate Limit Exceeded", details?: unknown) {
        return new AppError(429, "RATE_LIMIT_EXCEEDED", message, details);
    },
    internal(message = "Internal Server Error", details?: unknown) {
        return new AppError(500, "INTERNAL_SERVER_ERROR", message, details);
    },
    database(message = "Database Error", details?: unknown) {
        return new AppError(500, "DATABASE_ERROR", message, details);
    },
    serviceUnavailable(message = "Service Unavailable", details?: unknown) {
        return new AppError(503, "SERVICE_UNAVAILABLE", message, details);
    },
};

export type HttpErrorFactory = typeof httpError;


