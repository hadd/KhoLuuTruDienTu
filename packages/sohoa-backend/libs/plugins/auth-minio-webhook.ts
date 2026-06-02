import { Elysia } from "elysia";
import { httpError } from "@shared/common-lib";
import { env } from "../../env.ts";

function resolveWebhookSecret(): string {
    return env.MINIO_WEBHOOK_SECRET || env.INTERNAL_API_KEY;
}

export const plAuthMinioWebhook = new Elysia({
    name: "plugin_authMinioWebhook",
})
    .derive(async ({ request }) => {
        const expected = resolveWebhookSecret();
        if (!expected) {
            throw httpError.serviceUnavailable("MinIO webhook secret is not configured");
        }

        const authorization = request.headers.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) {
            throw httpError.unauthorized("Authorization Bearer token is required");
        }

        const token = authorization.slice("Bearer ".length).trim();
        if (token !== expected) {
            throw httpError.unauthorized("Invalid webhook token");
        }

        return { webhookAuthorized: true as const };
    }).as("scoped");
