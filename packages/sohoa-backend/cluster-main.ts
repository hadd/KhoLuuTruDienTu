import { env } from "./env.ts";
import { clientIpFromRequest, pickProcessIndex } from "./libs/cluster-route.ts";

const childProcesses: Deno.ChildProcess[] = [];

function stopChildren() {
  for (const child of childProcesses) {
    try {
      child.kill("SIGTERM");
    } catch {
      // already exited
    }
  }
}

function watchStopSignals() {
  const stop = () => {
    stopChildren();
    Deno.exit(0);
  };
  try {
    Deno.addSignalListener("SIGINT", stop);
  } catch {
    // not supported on this platform
  }
  try {
    Deno.addSignalListener("SIGTERM", stop);
  } catch {
    // not supported on this platform
  }
}

function remoteHostname(info: Deno.ServeHandlerInfo): string | null {
  const addr = info.remoteAddr;
  if (addr.transport === "tcp" || addr.transport === "udp") return addr.hostname;
  return null;
}

async function proxyHttp(
  req: Request,
  target: string,
  clientIp: string,
): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.set("x-forwarded-for", clientIp);
  headers.delete("host");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const init = {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: "manual" as const,
    duplex: "half" as const,
  };
  const response = await fetch(target, init as unknown as RequestInit);
  const outHeaders = new Headers(response.headers);
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("connection");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

function proxyWebSocket(req: Request, port: number, url: URL): Response {
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected websocket upgrade", { status: 400 });
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  const child = new WebSocket(`ws://127.0.0.1:${port}${url.pathname}${url.search}`);
  const pending: Array<string | ArrayBuffer> = [];
  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data !== "string" && !(data instanceof ArrayBuffer)) return;
    if (child.readyState === WebSocket.OPEN) child.send(data);
    else pending.push(data);
  };
  child.onopen = () => {
    for (const message of pending) child.send(message);
    pending.length = 0;
  };
  child.onmessage = (event) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
  };
  const closeBoth = () => {
    try {
      child.close();
    } catch {
      // ignore
    }
    try {
      socket.close();
    } catch {
      // ignore
    }
  };
  socket.onclose = closeBoth;
  child.onclose = closeBoth;
  socket.onerror = closeBoth;
  child.onerror = closeBoth;
  return response;
}

function startChildren(count: number): number[] {
  const ports: number[] = [];
  const cwd = import.meta.dirname ?? Deno.cwd();
  for (let index = 0; index < count; index++) {
    const port = env.PORT + 1 + index;
    ports.push(port);
    const child = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", "main.ts"],
      cwd,
      env: {
        ...Deno.env.toObject(),
        PORT: String(port),
        HOST: "127.0.0.1",
        CLUSTER_CHILD: "1",
        CLUSTER_INDEX: String(index),
      },
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    childProcesses.push(child);
    child.status.then((status) => {
      console.error(
        `[Cluster] Web process ${index} exited with code ${status.code}`,
      );
    });
  }
  return ports;
}

function serveCluster(count: number) {
  const ports = startChildren(count);
  watchStopSignals();
  Deno.serve({ hostname: env.HOST, port: env.PORT }, async (req, info) => {
    const url = new URL(req.url);
    const clientIp = clientIpFromRequest(
      req.headers.get("x-forwarded-for"),
      remoteHostname(info),
    );
    const port = ports[pickProcessIndex(clientIp, ports.length)]!;
    const target = `http://127.0.0.1:${port}${url.pathname}${url.search}`;
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return proxyWebSocket(req, port, url);
    }
    try {
      return await proxyHttp(req, target, clientIp);
    } catch (err) {
      console.error("[Cluster] Proxy failed:", err);
      return new Response("Web process unavailable", { status: 502 });
    }
  });
  console.info(
    `[Cluster] ${count} web processes behind http://${env.HOST}:${env.PORT}`,
  );
}

const clusterChild = Deno.env.get("CLUSTER_CHILD") === "1";
if (clusterChild || env.WEB_PROCESS_COUNT <= 1) {
  await import("./main.ts");
} else {
  serveCluster(env.WEB_PROCESS_COUNT);
}
