import { assertEquals } from "@std/assert";
import {
  completeExportDownloadTicket,
  consumeExportDownloadTicket,
  createExportDownloadTicket,
  ensureReplayContentType,
  failExportDownloadTicket,
  getExportDownloadStatus,
  isAllowedExportDownloadPath,
} from "../libs/export-download-ticket.ts";

Deno.test("isAllowedExportDownloadPath allows export ZIP routes only", () => {
  assertEquals(isAllowedExportDownloadPath("/api/v1/dossiers/metadata/export"), true);
  assertEquals(isAllowedExportDownloadPath("/api/v1/dossiers/abc/dip/export"), true);
  assertEquals(isAllowedExportDownloadPath("/api/v1/folders/abc/metadata/export?useDocumentNaming=true"), true);
  assertEquals(isAllowedExportDownloadPath("/api/v1/dossiers/metadata/export/preview"), false);
  assertEquals(isAllowedExportDownloadPath("/api/v1/users"), false);
});

Deno.test("ensureReplayContentType sets application/json when body present", () => {
  const withBody = ensureReplayContentType(
    { authorization: "Bearer token" },
    JSON.stringify({ dossierIds: ["a"], excelOnly: true }),
  );
  assertEquals(withBody["content-type"], "application/json");
  assertEquals(withBody.authorization, "Bearer token");

  const alreadySet = ensureReplayContentType(
    { "Content-Type": "application/json; charset=utf-8" },
    '{"excelOnly":true}',
  );
  assertEquals(alreadySet["Content-Type"], "application/json; charset=utf-8");
  assertEquals(alreadySet["content-type"], undefined);

  const noBody = ensureReplayContentType({ authorization: "Bearer x" }, undefined);
  assertEquals(noBody["content-type"], undefined);
});

Deno.test("export download tickets are one-shot", () => {
  const ticket = createExportDownloadTicket({
    ownerUserId: "user-1",
    method: "POST",
    path: "/api/v1/dossiers/metadata/export",
    bodyText: "{\"dossierIds\":[\"a\"]}",
    headers: { authorization: "Bearer token" },
  });

  const firstConsume = consumeExportDownloadTicket(ticket.id);
  const secondConsume = consumeExportDownloadTicket(ticket.id);

  assertEquals(firstConsume?.state, "started");
  assertEquals(secondConsume, null);
});

Deno.test("export download status is scoped to owner and terminal state", () => {
  const ticket = createExportDownloadTicket({
    ownerUserId: "user-2",
    method: "GET",
    path: "/api/v1/dossiers/abc/metadata/export",
    headers: { authorization: "Bearer token" },
  });

  consumeExportDownloadTicket(ticket.id);
  failExportDownloadTicket(ticket.id, {
    statusCode: 500,
    errorMessage: "broken stream",
  });

  const ownerStatus = getExportDownloadStatus(ticket.id, "user-2");
  const otherStatus = getExportDownloadStatus(ticket.id, "user-x");

  assertEquals(ownerStatus?.state, "failed");
  assertEquals(ownerStatus?.statusCode, 500);
  assertEquals(ownerStatus?.errorMessage, "broken stream");
  assertEquals(otherStatus, null);
});

Deno.test("export download completion is reflected in status", () => {
  const ticket = createExportDownloadTicket({
    ownerUserId: "user-3",
    method: "GET",
    path: "/api/v1/folders/metadata/export",
    headers: { authorization: "Bearer token" },
  });

  consumeExportDownloadTicket(ticket.id);
  completeExportDownloadTicket(ticket.id);

  const status = getExportDownloadStatus(ticket.id, "user-3");
  assertEquals(status?.state, "completed");
});
