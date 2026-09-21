import { httpError } from "@shared/common-lib";
import { Elysia, t } from "elysia";
import { env } from "../../env.ts";
import {
  completeExportDownloadTicket,
  consumeExportDownloadTicket,
  createExportDownloadTicket,
  ensureReplayContentType,
  failExportDownloadTicket,
  getExportDownloadStatus,
  setExportDownloadZipPasswordSource,
} from "../../libs/export-download-ticket.ts";
import { ZIP_PASSWORD_SOURCE_HEADER } from "../../libs/zip-stream-response.ts";
import { plugins } from "../../libs/plugins/_index.ts";

const HEADER_NAMES = [
  "authorization",
  "content-type",
  "x-security-level-token",
  "x-security-level-tokens",
  "x-dossier-access-token",
  "x-dossier-access-tokens",
  "x-file-access-tokens",
] as const;

const createTicketBodySchema = t.Object({
  method: t.Union([t.Literal("GET"), t.Literal("POST")]),
  path: t.String({ minLength: 1 }),
  body: t.Optional(t.Any()),
});

const idParamSchema = t.Object({
  id: t.String({ minLength: 1 }),
});

function copyReplayHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of HEADER_NAMES) {
    const value = request.headers.get(name);
    if (value?.trim()) {
      headers[name] = value;
    }
  }
  return headers;
}

function buildLoopbackUrl(path: string): string {
  return new URL(path, `http://127.0.0.1:${env.PORT}`).toString();
}

function normalizeFailureMessage(
  bodyText: string,
  status: number,
  statusText: string,
): string {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return `Download failed: ${status} ${statusText}`.trim();
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
    };
    const errorValue = typeof parsed.error === "string"
      ? parsed.error
      : typeof parsed.message === "string"
      ? parsed.message
      : trimmed;
    return errorValue.trim() || `Download failed: ${status} ${statusText}`.trim();
  } catch {
    return trimmed;
  }
}

function wrapDownloadBody(ticketId: string, body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          completeExportDownloadTicket(ticketId);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        failExportDownloadTicket(ticketId, {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        failExportDownloadTicket(ticketId, {
          errorMessage: "Download was cancelled before completion",
        });
      }
    },
  });
}

export function createExportDownloadRouter(basePath = "/export-downloads") {
  const app = new Elysia({
    name: "exportDownloadRouter",
    prefix: basePath,
  }).use(plugins.authProfile);

  app.post(
    "/",
    async ({ body, profile, request }) => {
      if (body.method === "GET" && body.body !== undefined) {
        throw httpError.badRequest("GET export download cannot include a body");
      }
      const headers = copyReplayHeaders(request);
      const ticket = createExportDownloadTicket({
        ownerUserId: profile.id,
        method: body.method,
        path: body.path,
        bodyText: body.body === undefined ? undefined : JSON.stringify(body.body),
        headers,
      });
      return {
        id: ticket.id,
        downloadUrl: `/api/public/export-downloads/${ticket.id}`,
        statusUrl: `/api/v1/export-downloads/${ticket.id}/status`,
        expiresAt: ticket.expiresAt,
      };
    },
    {
      body: createTicketBodySchema,
      detail: {
        tags: ["ExportDownload"],
        summary: "Create a native export download ticket",
      },
    },
  );

  app.get(
    "/:id/status",
    async ({ params, profile }) => {
      const status = getExportDownloadStatus(params.id, profile.id);
      if (!status) {
        throw httpError.notFound("Export download ticket not found");
      }
      return status;
    },
    {
      params: idParamSchema,
      detail: {
        tags: ["ExportDownload"],
        summary: "Get native export download status",
      },
    },
  );

  return app;
}

export function createPublicExportDownloadRouter(basePath = "/export-downloads") {
  const app = new Elysia({
    name: "publicExportDownloadRouter",
    prefix: basePath,
  });

  app.get(
    "/:id",
    async ({ params }) => {
      const ticket = consumeExportDownloadTicket(params.id);
      if (!ticket) {
        throw httpError.notFound("Export download ticket not found or expired");
      }

      let response: Response;
      try {
        const headers = ensureReplayContentType(
          ticket.headers,
          ticket.bodyText,
        );
        response = await fetch(buildLoopbackUrl(ticket.path), {
          method: ticket.method,
          headers,
          body: ticket.bodyText,
        });
      } catch (error) {
        failExportDownloadTicket(params.id, {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const zipPasswordSource = response.headers.get(ZIP_PASSWORD_SOURCE_HEADER);
      setExportDownloadZipPasswordSource(params.id, zipPasswordSource);

      if (!response.ok) {
        const bodyText = await response.text();
        const errorMessage = normalizeFailureMessage(
          bodyText,
          response.status,
          response.statusText,
        );
        failExportDownloadTicket(params.id, {
          statusCode: response.status,
          errorMessage,
        });
        return new Response(errorMessage, {
          status: response.status,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      if (!response.body) {
        failExportDownloadTicket(params.id, {
          statusCode: 502,
          errorMessage: "Export download stream is empty",
        });
        return new Response("Export download stream is empty", {
          status: 502,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      const headers = new Headers();
      for (const name of [
        "content-type",
        "content-disposition",
        "x-content-type-options",
        ZIP_PASSWORD_SOURCE_HEADER,
      ]) {
        const value = response.headers.get(name);
        if (value) {
          headers.set(name, value);
        }
      }
      headers.set("Cache-Control", "no-store");

      return new Response(wrapDownloadBody(params.id, response.body), {
        status: response.status,
        headers,
      });
    },
    {
      params: idParamSchema,
      detail: {
        tags: ["ExportDownload"],
        summary: "Consume native export download ticket",
      },
    },
  );

  return app;
}
