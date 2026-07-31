import { createServer } from "node:http"
import { env } from "./env.ts"
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { initSocketIo } from "./libs/socket-io.ts"
import { createElysiaNodeHandler } from "./libs/node-http-bridge.ts"
import { requestWithClientIp } from "./libs/resolve-client-ip.ts"

import { createOnErrorHandler, loggerPlugin, swaggerPlugin } from "@shared/http-libs"
import { adminRouter } from "./router/router.admin.ts"
import { publicRouter } from "./router/router.public.ts"
import { apiV1Router } from "./router/router.ts"
import { createAuthProtectedRouter, createAuthPublicRouter } from "./modules/auth/index.ts"
import { plugins } from "./libs/plugins/_index.ts"

const routeWithoutAuth = new Elysia()

function shouldEnableCors() {
  return (
    env.NODE_ENV === "local" ||
    env.NODE_ENV === "development" ||
    env.CORS_ORIGINS.length > 0
  )
}

function createCorsPlugin() {
  const origin = env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true

  return cors({
    origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "x-security-level-token",
      "x-security-level-tokens",
      "x-dossier-access-token",
      "x-dossier-access-tokens",
      "x-file-access-tokens",
    ],
    exposeHeaders: ["Content-Disposition"],
  })
}

const app = new Elysia({
  encodeSchema: false,
})

if (shouldEnableCors()) {
  app.use(createCorsPlugin())
}

app
  .use(
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
  .use(routeWithoutAuth)

// Export app for testing
export { app }

function startHttpServer() {
  const port = Number(env.PORT)

  if (env.SOCKET_ENABLED) {
    const httpServer = createServer(createElysiaNodeHandler(app.fetch))
    httpServer.requestTimeout = 0
    httpServer.headersTimeout = 0
    httpServer.timeout = 0
    httpServer.keepAliveTimeout = 120_000
    initSocketIo(httpServer)
    httpServer.listen(port, env.HOST, () => {
      console.info(
        `[HTTP] Server listening on http://${env.HOST}:${port} (Socket.IO enabled)`,
      )
    })
    return
  }

  Deno.serve({ hostname: env.HOST, port }, (request, info) => {
    const remoteIp =
      info.remoteAddr.transport === "tcp" || info.remoteAddr.transport === "udp"
        ? info.remoteAddr.hostname
        : null
    return app.handle(requestWithClientIp(request, remoteIp))
  })
  console.info(`[HTTP] Server listening on http://${env.HOST}:${port}`)
}

if (Deno.env.get("NODE_ENV") !== "test") {
  startHttpServer()
}
