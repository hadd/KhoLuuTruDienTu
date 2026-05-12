import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { logApp } from "@shared/common-lib";
export interface SwaggerPluginOptions {
    path?: string;
    title?: string;
    version?: string;
    description?: string;
}

export function swaggerPlugin(options: SwaggerPluginOptions = {}) {
    const { path = "/docs", title = "API", version = "1.0.0", description } = options;
    logApp(`API Docs available at http://${Deno.env.get("HOST") || "0.0.0.0"}:${Deno.env.get("PORT") ?? 8000}${path}`);

    return new Elysia({ name: "swagger-plugin" }).use(
        swagger({
            path,
            documentation: {
                info: {
                    title,
                    version,
                    description,
                },
                components: {
                    securitySchemes: {
                        BearerAuth: {
                            type: "http",
                            scheme: "bearer",
                            bearerFormat: "JWT",
                            description: "Enter your JWT access token from POST /api/auth/login or /api/auth/refresh."
                        },
                        ApiKeyAuth: {
                            type: "apiKey",
                            in: "header",
                            name: "X-API-Key",
                            description: "Enter your API key in the X-API-Key header"
                        }
                    }
                },
                security: [
                    {
                        BearerAuth: []
                    },
                    {
                        ApiKeyAuth: []
                    }
                ]
            },
        }),
    );
}


