import { assertEquals } from "@std/assert"
import { securityAccessHeadersFromRequest } from "../modules/security-level/security-enforcement.ts"

Deno.test("securityAccessHeadersFromRequest parses and deduplicates dossier tokens", () => {
  const request = new Request("http://localhost", {
    headers: {
      "x-dossier-access-token": "token-a",
      "x-dossier-access-tokens": "token-a, token-b",
    },
  })

  assertEquals(securityAccessHeadersFromRequest(request), {
    levelToken: undefined,
    levelTokens: undefined,
    dossierToken: "token-a",
    dossierTokens: ["token-a", "token-b"],
    fileTokens: undefined,
  })
})
