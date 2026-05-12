import { Elysia } from "elysia";
import { httpError } from "@shared/common-lib";
import { env } from "../../env.ts";

export const plAuthInternalApi = new Elysia({
    name: "plugin_authInternalApi",
})
    .derive(async ({ request }) => {
        const apiKey = request.headers.get("X-API-Key");
        if (!apiKey) {
            throw httpError.unauthorized("X-API-Key header is required");
        }
        if (!env.INTERNAL_API_KEY) {
            throw httpError.serviceUnavailable("Service is not available");
        }
        if (apiKey !== env.INTERNAL_API_KEY) {
            throw httpError.unauthorized("Invalid API key");
        }
        return { internalApiKey: apiKey };
    }).as("scoped");

