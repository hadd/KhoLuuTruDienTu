import { env } from "./env.ts";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { createOnErrorHandler, loggerPlugin, swaggerPlugin } from "@shared/http-libs";
import { adminRouter } from "./router/router.admin.ts";
import { publicRouter } from "./router/router.public.ts";
import { apiV1Router } from "./router/router.ts";
import { createAuthPublicRouter, createAuthProtectedRouter } from "./modules/auth/index.ts";
import { plugins } from "./libs/plugins/_index.ts";

const routeWithoutAuth = new Elysia();

function shouldEnableCors() {
    return env.NODE_ENV === "local"
        || env.NODE_ENV === "development"
        || env.CORS_ORIGINS.length > 0;
}

function createCorsPlugin() {
    const origin = env.CORS_ORIGINS.length > 0
        ? env.CORS_ORIGINS
        : true;

    return cors({
        origin,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    });
}

const app = new Elysia({
    encodeSchema: false,
});

if (shouldEnableCors()) {
    app.use(createCorsPlugin());
}

app.use(
    swaggerPlugin({
        path: "/api-docs",
        title: "Sohoa BE API",
        version: "1.0.0",
        // description: Deno.readTextFileSync("./docs/app_api_doc.md"),
    }),
)
    .use(plugins.urlQuery)
    .use(loggerPlugin())
    .onError(createOnErrorHandler())
    .use(publicRouter)
    .use(createAuthPublicRouter())
    .use(createAuthProtectedRouter())
    .use(adminRouter)
    .use(apiV1Router)
    .use(routeWithoutAuth);

// Export app for testing
export { app };

if (Deno.env.get("NODE_ENV") !== "test") {
    Deno.serve({ hostname: env.HOST, port: Number(env.PORT) }, app.handle);
}