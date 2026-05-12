import { Elysia, t } from "elysia";
import postgres from "postgres";
import { logApp, logDb } from "@shared/common-lib";

const SERVICE_START_TIME = new Date();

export interface HealthPluginOptions {
    basePath?: string;
    checks?: HealthCheck[];
    db_connection_str?: string;
}

export interface HealthCheckResult {
    status: string;
    latency?: number;
    details?: unknown;
}

export interface HealthCheck {
    name: string;
    check: () => Promise<HealthCheckResult>;
}

export interface HealthResponse {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    uptime: {
        startedAt: string;
        uptimeMs: number;
    };
    services: Record<string, HealthCheckResult>;
    system: {
        memory: {
            used: number;
            total: number;
            percentage: number;
        };
        platform: string;
        nodeVersion: string;
    };
}

async function checkDatabaseHealth(dbConnectionStr: string): Promise<HealthCheckResult> {
    let client: ReturnType<typeof postgres> | null = null;

    try {
        const start = Date.now();
        client = postgres(dbConnectionStr, {
            max: 1,
            connect_timeout: 3,
            idle_timeout: 1,
            max_lifetime: 1,
        });

        await client`SELECT 1`;

        const latency = Date.now() - start;

        return {
            status: "healthy",
            latency,
        };
    } catch (error) {
        logDb.error({ error }, "Database health check failed");
        return {
            status: "unhealthy",
            details: { error: error instanceof Error ? error.message : "Unknown error" },
        };
    } finally {
        // Ensure connection is properly closed
        if (client) {
            try {
                await client.end({ timeout: 0.1 });
            } catch (_closeError) {
                // Ignore close errors in health check
            }
        }
    }
}

const HealthResponseSchema = t.Object({
    status: t.Union([
        t.Literal("healthy"),
        t.Literal("unhealthy"),
        t.Literal("degraded"),
    ]),
    timestamp: t.String(),
    uptime: t.Object({
        startedAt: t.String(),
        uptimeMs: t.Number(),
    }),
    services: t.Record(
        t.String(),
        t.Object({
            status: t.String(),
            latency: t.Optional(t.Number()),
            details: t.Optional(t.Any()),
        }),
    ),
    system: t.Object({
        memory: t.Object({
            used: t.Number(),
            total: t.Number(),
            percentage: t.Number(),
        }),
        platform: t.String(),
        nodeVersion: t.String(),
    }),
});

export function healthPlugin(options: {
    basePath?: string;
    checks?: HealthCheck[];
    db_connection_str?: string;
} = {}) {
    const basePath = options.basePath ?? "/health";
    const checks = options.checks ?? [];
    if (options.db_connection_str) {
        checks.push({
            name: "database",
            check: () => checkDatabaseHealth(options.db_connection_str!),
        });
    }

    return (app: Elysia) =>
        app
            .get(
                basePath,
                async () => {
                    const now = new Date();
                    const uptimeMs = now.getTime() - SERVICE_START_TIME.getTime();

                    const serviceResults: Record<string, HealthCheckResult> = {};
                    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

                    for (const check of checks) {
                        try {
                            const result = await check.check();
                            serviceResults[check.name] = result;

                            if (result.status === "unhealthy") {
                                overallStatus = "unhealthy";
                            } else if (result.status === "degraded" && overallStatus === "healthy") {
                                overallStatus = "degraded";
                            }
                        } catch (error) {
                            logApp.error({ error, check: check.name }, "Health check failed");
                            serviceResults[check.name] = {
                                status: "unhealthy",
                                details: { error: error instanceof Error ? error.message : "Unknown error" },
                            };
                            overallStatus = "unhealthy";
                        }
                    }

                    const memoryUsage = Deno.memoryUsage();
                    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
                    const usedMemory = memoryUsage.heapUsed + memoryUsage.external;
                    const memoryPercentage = (usedMemory / totalMemory) * 100;

                    const response: HealthResponse = {
                        status: overallStatus,
                        timestamp: now.toISOString(),
                        uptime: {
                            startedAt: SERVICE_START_TIME.toISOString(),
                            uptimeMs,
                        },
                        services: serviceResults,
                        system: {
                            memory: {
                                used: usedMemory,
                                total: totalMemory,
                                percentage: Math.round(memoryPercentage * 100) / 100,
                            },
                            platform: Deno.build.os,
                            nodeVersion: Deno.version.deno,
                        },
                    };

                    logApp(
                        {
                            status: overallStatus,
                            uptimeMs,
                            services: Object.keys(serviceResults),
                        },
                        "Health check performed",
                    );

                    return response;
                },
                {
                    detail: {
                        tags: ["Health"],
                        summary: "Health check endpoint",
                        description: "",
                    },
                    response: HealthResponseSchema,
                },
            );
}
