import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeClientIp } from "./resolve-client-ip.ts";

type FetchHandler = (request: Request) => Response | Promise<Response>;

function hasProxyClientIp(headers: IncomingMessage["headers"]): boolean {
  return Boolean(
    headers["x-forwarded-for"] ||
      headers["x-real-ip"] ||
      headers["cf-connecting-ip"],
  );
}

function nodeRequestToWebRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const hasBody = req.method != null && !/^(GET|HEAD)$/i.test(req.method);

  const headers = { ...req.headers } as Record<string, string | string[] | undefined>;
  if (!hasProxyClientIp(req.headers)) {
    const remoteIp = normalizeClientIp(req.socket.remoteAddress);
    if (remoteIp) {
      headers["x-forwarded-for"] = remoteIp;
    }
  }

  return new Request(url, {
    method: req.method,
    headers: headers as HeadersInit,
    body: hasBody
      ? new ReadableStream({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(chunk));
            req.on("end", () => controller.close());
            req.on("error", (err) => controller.error(err));
          },
        })
      : undefined,
    // Required when sending a streaming body in Node fetch
    duplex: "half",
  } as RequestInit);
}

async function writeWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") {
      return;
    }
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      res.write(value);
    }
  }
  res.end();
}

/** Adapts Elysia's fetch handler to Node's `http.createServer` (for Socket.IO on the same port). */
export function createElysiaNodeHandler(fetchHandler: FetchHandler) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const request = nodeRequestToWebRequest(req);
      const response = await fetchHandler(request);
      await writeWebResponse(res, response);
    } catch (err) {
      console.error("[HTTP] Request failed:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  };
}
