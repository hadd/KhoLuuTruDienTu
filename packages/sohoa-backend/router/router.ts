import { Elysia } from "elysia"
import { plugins } from "../libs/plugins/_index.ts"
import { createProfileRouter } from "../modules/profile/profile.router.ts"

export const apiV1Router = new Elysia({
    prefix: "/api/v1",
})
    .use(plugins.authProfile)
    .use(createProfileRouter("/users"))
