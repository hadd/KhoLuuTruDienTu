# API Helpers Usage Examples

## Overview
The `@shared/common-lib` now includes comprehensive API response helpers for standardized JSON responses and error handling in Oak applications.

## Response Helpers

### Success Responses

```typescript
import { sendSuccess, sendCreated, sendList, apiResponse } from "@shared/common-lib";

// Simple success response
sendSuccess(ctx, { id: 1, name: "John" }, "User retrieved successfully");

// Created response (201 status)
sendCreated(ctx, { id: 1, name: "John" }, "User created successfully");

// List response with pagination
sendList(ctx, users, {
    page: 1,
    limit: 10,
    total: 100
}, "Users retrieved successfully");

// Custom response
const response = apiResponse(data, "Custom message", {
    requestId: "req-123",
    pagination: { page: 1, limit: 10, total: 100, totalPages: 10 }
});
sendResponse(ctx, response);
```

### Error Responses

```typescript
import { sendError, apiErrorHelpers } from "@shared/common-lib";

// Using predefined error helpers
throw apiErrorHelpers.badRequest("Invalid input data");
throw apiErrorHelpers.notFound("User not found");
throw apiErrorHelpers.unauthorized("Authentication required");
throw apiErrorHelpers.validationError("Email format is invalid");

// Sending error response
try {
    // some operation
} catch (error) {
    if (error instanceof AppError) {
        sendError(ctx, error);
    } else {
        sendError(ctx, apiErrorHelpers.internalServerError("Something went wrong"));
    }
}
```

### Validation Helpers

```typescript
import { validateRequired, validateEmail, validateUuid, validatePagination } from "@shared/common-lib";

// Validate required fields
const userId = validateRequired(ctx.params.id, "User ID");
const email = validateEmail(ctx.request.body.email);

// Validate UUID format
const validUuid = validateUuid(ctx.params.id);

// Validate pagination parameters
const { page, limit } = validatePagination(
    Number(ctx.request.url.searchParams.get("page")),
    Number(ctx.request.url.searchParams.get("limit"))
);
```

## Complete Router Example

```typescript
import { Router } from "oak";
import { 
    sendSuccess, 
    sendCreated, 
    sendList, 
    sendError, 
    apiErrorHelpers, 
    validateRequired, 
    validateUuid 
} from "@shared/common-lib";

const router = new Router({ prefix: "/api/users" });

// GET /api/users - List users
router.get("/", async (ctx) => {
    try {
        const query = Object.fromEntries(ctx.request.url.searchParams);
        const result = await UserService.list(query);
        
        if (Array.isArray(result)) {
            sendList(ctx, result, undefined, "Users retrieved successfully");
        } else {
            const pagination = {
                page: result.page,
                limit: result.limit,
                total: result.total,
            };
            sendList(ctx, result.items, pagination, "Users retrieved successfully");
        }
    } catch (error) {
        if (error instanceof AppError) {
            sendError(ctx, error);
        } else {
            sendError(ctx, apiErrorHelpers.internalServerError("Failed to retrieve users"));
        }
    }
});

// GET /api/users/:id - Get user by ID
router.get("/:id", async (ctx) => {
    try {
        const id = validateRequired(ctx.params.id, "User ID");
        validateUuid(id);
        
        const user = await UserService.get(id);
        if (!user) {
            throw apiErrorHelpers.notFound("User not found");
        }
        
        sendSuccess(ctx, user, "User retrieved successfully");
    } catch (error) {
        if (error instanceof AppError) {
            sendError(ctx, error);
        } else {
            sendError(ctx, apiErrorHelpers.notFound("User not found"));
        }
    }
});

// POST /api/users - Create user
router.post("/", async (ctx) => {
    try {
        const body = await ctx.request.body().value;
        if (!body) {
            throw apiErrorHelpers.badRequest("Request body is required");
        }
        
        const user = await UserService.create(body);
        sendCreated(ctx, user, "User created successfully");
    } catch (error) {
        if (error instanceof AppError) {
            sendError(ctx, error);
        } else {
            sendError(ctx, apiErrorHelpers.badRequest("Invalid request body"));
        }
    }
});
```

## Response Format

### Success Response
```json
{
    "success": true,
    "data": { "id": 1, "name": "John" },
    "message": "User retrieved successfully",
    "meta": {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "requestId": "req-123",
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 100,
            "totalPages": 10
        }
    }
}
```

### Error Response
```json
{
    "success": false,
    "error": {
        "code": "NOT_FOUND",
        "message": "User not found",
        "details": null,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "requestId": "req-123"
    }
}
```

## Available Error Helpers

- `apiErrorHelpers.badRequest(message, details?)` - 400 Bad Request
- `apiErrorHelpers.unauthorized(message, details?)` - 401 Unauthorized  
- `apiErrorHelpers.forbidden(message, details?)` - 403 Forbidden
- `apiErrorHelpers.notFound(message, details?)` - 404 Not Found
- `apiErrorHelpers.conflict(message, details?)` - 409 Conflict
- `apiErrorHelpers.unprocessableEntity(message, details?)` - 422 Unprocessable Entity
- `apiErrorHelpers.internalServerError(message, details?)` - 500 Internal Server Error
- `apiErrorHelpers.databaseError(message, details?)` - 500 Database Error
- `apiErrorHelpers.validationError(message, details?)` - 422 Validation Error
- `apiErrorHelpers.rateLimitError(message, details?)` - 429 Rate Limit Exceeded
- `apiErrorHelpers.serviceUnavailable(message, details?)` - 503 Service Unavailable
