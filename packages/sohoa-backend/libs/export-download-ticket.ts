export type ExportDownloadMethod = "GET" | "POST";

export type ExportDownloadState =
  | "pending"
  | "started"
  | "completed"
  | "failed";

export type ZipPasswordSource = "personal_pin" | "dossier" | "none";

export type ExportDownloadTicketCreateInput = {
  ownerUserId: string;
  method: ExportDownloadMethod;
  path: string;
  bodyText?: string;
  headers: Record<string, string>;
};

type ExportDownloadTicketRecord = {
  id: string;
  ownerUserId: string;
  method: ExportDownloadMethod;
  path: string;
  bodyText?: string;
  headers: Record<string, string>;
  state: ExportDownloadState;
  zipPasswordSource?: ZipPasswordSource;
  statusCode?: number;
  errorMessage?: string;
  createdAt: number;
  expiresAt: number;
  terminalExpiresAt?: number;
  consumedAt?: number;
};

export type ExportDownloadTicketSnapshot = {
  id: string;
  ownerUserId: string;
  method: ExportDownloadMethod;
  path: string;
  bodyText?: string;
  headers: Record<string, string>;
  state: ExportDownloadState;
  zipPasswordSource?: ZipPasswordSource;
  statusCode?: number;
  errorMessage?: string;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
};

export type ExportDownloadStatus = {
  id: string;
  state: ExportDownloadState;
  statusCode?: number;
  errorMessage?: string;
  zipPasswordSource?: ZipPasswordSource;
  createdAt: number;
  consumedAt?: number;
  expiresAt: number;
};

const TICKET_TTL_MS = 2 * 60 * 1000;
const TERMINAL_TTL_MS = 10 * 60 * 1000;
const ALLOWED_EXPORT_PATTERNS = [
  /^\/api\/v1\/dossiers\/metadata\/export$/,
  /^\/api\/v1\/dossiers\/dip\/export$/,
  /^\/api\/v1\/folders\/metadata\/export$/,
  /^\/api\/v1\/dossiers\/[^/]+\/metadata\/export$/,
  /^\/api\/v1\/dossiers\/[^/]+\/dip\/export$/,
  /^\/api\/v1\/folders\/[^/]+\/metadata\/export$/,
];

const tickets = new Map<string, ExportDownloadTicketRecord>();

function cleanupExpiredTickets(now = Date.now()) {
  for (const [id, ticket] of tickets.entries()) {
    const deadline = ticket.terminalExpiresAt ?? ticket.expiresAt;
    if (deadline <= now) {
      tickets.delete(id);
    }
  }
}

function terminalize(
  ticket: ExportDownloadTicketRecord,
  state: Extract<ExportDownloadState, "completed" | "failed">,
  options?: {
    statusCode?: number;
    errorMessage?: string;
    zipPasswordSource?: ZipPasswordSource;
  },
) {
  ticket.state = state;
  ticket.statusCode = options?.statusCode;
  ticket.errorMessage = options?.errorMessage;
  if (options?.zipPasswordSource) {
    ticket.zipPasswordSource = options.zipPasswordSource;
  }
  ticket.terminalExpiresAt = Date.now() + TERMINAL_TTL_MS;
  ticket.headers = {};
  ticket.bodyText = undefined;
}

function normalizeDownloadPath(path: string): string {
  if (!path?.trim()) {
    throw new Error("Export download path is required");
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    throw new Error("Absolute URLs are not allowed");
  }
  const url = new URL(path, "http://localhost");
  if (!url.pathname.startsWith("/")) {
    throw new Error("Export download path must start with /");
  }
  return `${url.pathname}${url.search}`;
}

export function isAllowedExportDownloadPath(path: string): boolean {
  const normalized = normalizeDownloadPath(path);
  const url = new URL(normalized, "http://localhost");
  return ALLOWED_EXPORT_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

/**
 * Ensure loopback replay of a ticket with a JSON body carries Content-Type.
 * Without it, Elysia may leave the body unparsed and drop flags like excelOnly.
 */
export function ensureReplayContentType(
  headers: Record<string, string>,
  bodyText: string | undefined,
): Record<string, string> {
  const next = { ...headers };
  if (bodyText !== undefined) {
    const hasContentType = Object.keys(next).some(
      (key) => key.toLowerCase() === "content-type",
    );
    if (!hasContentType) {
      next["content-type"] = "application/json";
    }
  }
  return next;
}

export function createExportDownloadTicket(
  input: ExportDownloadTicketCreateInput,
): ExportDownloadTicketSnapshot {
  cleanupExpiredTickets();
  const path = normalizeDownloadPath(input.path);
  if (!isAllowedExportDownloadPath(path)) {
    throw new Error(`Path is not allowed for native export download: ${path}`);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const record: ExportDownloadTicketRecord = {
    id,
    ownerUserId: input.ownerUserId,
    method: input.method,
    path,
    bodyText: input.bodyText,
    headers: { ...input.headers },
    state: "pending",
    createdAt: now,
    expiresAt: now + TICKET_TTL_MS,
  };
  tickets.set(id, record);
  return { ...record, headers: { ...record.headers } };
}

export function consumeExportDownloadTicket(
  id: string,
): ExportDownloadTicketSnapshot | null {
  cleanupExpiredTickets();
  const ticket = tickets.get(id);
  if (!ticket || ticket.state !== "pending") {
    return null;
  }
  const now = Date.now();
  if (ticket.expiresAt <= now) {
    tickets.delete(id);
    return null;
  }
  ticket.state = "started";
  ticket.consumedAt = now;
  return { ...ticket, headers: { ...ticket.headers } };
}

export function setExportDownloadZipPasswordSource(
  id: string,
  zipPasswordSource: string | null | undefined,
) {
  const ticket = tickets.get(id);
  if (!ticket) return;
  if (
    zipPasswordSource === "personal_pin" ||
    zipPasswordSource === "dossier" ||
    zipPasswordSource === "none"
  ) {
    ticket.zipPasswordSource = zipPasswordSource;
  }
}

export function completeExportDownloadTicket(id: string) {
  const ticket = tickets.get(id);
  if (!ticket) return;
  terminalize(ticket, "completed");
}

export function failExportDownloadTicket(
  id: string,
  options?: {
    statusCode?: number;
    errorMessage?: string;
    zipPasswordSource?: ZipPasswordSource;
  },
) {
  const ticket = tickets.get(id);
  if (!ticket) return;
  terminalize(ticket, "failed", options);
}

export function getExportDownloadStatus(
  id: string,
  ownerUserId: string,
): ExportDownloadStatus | null {
  cleanupExpiredTickets();
  const ticket = tickets.get(id);
  if (!ticket || ticket.ownerUserId !== ownerUserId) {
    return null;
  }
  return {
    id: ticket.id,
    state: ticket.state,
    statusCode: ticket.statusCode,
    errorMessage: ticket.errorMessage,
    zipPasswordSource: ticket.zipPasswordSource,
    createdAt: ticket.createdAt,
    consumedAt: ticket.consumedAt,
    expiresAt: ticket.terminalExpiresAt ?? ticket.expiresAt,
  };
}
