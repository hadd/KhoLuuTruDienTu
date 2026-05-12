import { Context } from "oak";
import { AppError, httpError } from "./http-error.ts";

// Standard API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    meta?: {
        timestamp: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
        timestamp: string;
        requestId?: string;
    };
}

// Success Response Helpers
export function apiResponse<T>(
    data: T,
    message?: string,
    meta?: Partial<ApiResponse<T>['meta']>
): ApiResponse<T> {
    return {
        success: true,
        data,
        message,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta,
        },
    };
}

export function apiSuccess<T>(
    data: T,
    message = "Operation successful"
): ApiResponse<T> {
    return apiResponse(data, message);
}

export function apiCreated<T>(
    data: T,
    message = "Resource created successfully"
): ApiResponse<T> {
    return apiResponse(data, message);
}

export function apiUpdated<T>(
    data: T,
    message = "Resource updated successfully"
): ApiResponse<T> {
    return apiResponse(data, message);
}

export function apiDeleted(
    message = "Resource deleted successfully"
): ApiResponse<null> {
    return apiResponse(null, message);
}

export function apiList<T>(
    data: T[],
    pagination?: {
        page: number;
        limit: number;
        total: number;
    },
    message = "List retrieved successfully"
): ApiResponse<T[]> {
    const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;
    
    return apiResponse(data, message, {
        pagination: pagination ? {
            ...pagination,
            totalPages,
        } : undefined,
    });
}

// Error Response Helpers
export function apiError(
    error: AppError,
    requestId?: string
): ApiErrorResponse {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.message,
            details: error.details,
            timestamp: error.timestamp,
            requestId,
        },
    };
}

// Convenience error creation functions
export const apiErrorHelpers = httpError;

// Context-aware response helpers for Oak
export function sendResponse<T>(
    ctx: Context,
    response: ApiResponse<T>,
    status = 200
): void {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = response;
}

export function sendSuccess<T>(
    ctx: Context,
    data: T,
    message?: string,
    status = 200
): void {
    const response = apiResponse(data, message, {
        requestId: ctx.state.requestId as string,
    });
    sendResponse(ctx, response, status);
}

export function sendCreated<T>(
    ctx: Context,
    data: T,
    message?: string
): void {
    sendSuccess(ctx, data, message, 201);
}

export function sendList<T>(
    ctx: Context,
    data: T[],
    pagination?: {
        page: number;
        limit: number;
        total: number;
    },
    message?: string
): void {
    const response = apiList(data, pagination, message);
    response.meta!.requestId = ctx.state.requestId as string;
    sendResponse(ctx, response);
}

export function sendError(
    ctx: Context,
    error: AppError,
    status?: number
): void {
    const response = apiError(error, ctx.state.requestId as string);
    ctx.response.status = status || error.status;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = response;
}

// Validation helpers
export function validateRequired<T>(
    value: T | undefined | null,
    fieldName: string
): T {
    if (value === undefined || value === null || value === "") {
        throw apiErrorHelpers.validationError(`${fieldName} is required`);
    }
    return value;
}

export function validateEmail(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw apiErrorHelpers.validationError("Invalid email format");
    }
    return email;
}

export function validateUuid(uuid: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
        throw apiErrorHelpers.validationError("Invalid UUID format");
    }
    return uuid;
}

export function validatePagination(page?: number, limit?: number): { page: number; limit: number } {
    const validPage = Math.max(1, page || 1);
    const validLimit = Math.min(Math.max(1, limit || 10), 100); // Max 100 items per page
    
    return { page: validPage, limit: validLimit };
}
