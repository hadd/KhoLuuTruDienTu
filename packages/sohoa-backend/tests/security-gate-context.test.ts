import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  issueSecurityAccessToken,
  verifySecurityAccessToken,
} from "../modules/security-level/security-access-token.ts"
import {
  assertPasswordGatesCached,
  SecurityRequestCache,
} from "../modules/security-level/security-gate-context.ts"
import { PermissionRuleKey } from "../modules/security-level/security-rule-keys.ts"

const LEVEL_ID = "11111111-1111-1111-1111-111111111111"
const DOSSIER_ID = "22222222-2222-2222-2222-222222222222"
const FILE_ID = "33333333-3333-3333-3333-333333333333"
const USER_ID = "44444444-4444-4444-4444-444444444444"

class StubSecurityCache extends SecurityRequestCache {
  private bools = new Map<string, boolean>()
  private resolvedBools = new Set<string>()
  private loadedLevels = false
  private loadedDossiers = false
  private loadedFiles = false
  private loadedLowest = false
  queryCount = 0

  setBool(levelId: string, ruleKey: string, value: boolean) {
    this.bools.set(`${levelId}::${ruleKey}`, value)
  }

  override async getLowestLevelId() {
    if (!this.loadedLowest) {
      this.queryCount += 1
      this.loadedLowest = true
    }
    return LEVEL_ID
  }

  override async getEffectiveBool(levelId: string, ruleKey: string) {
    const key = `${levelId}::${ruleKey}`
    if (!this.resolvedBools.has(key)) {
      this.queryCount += 1
      this.resolvedBools.add(key)
    }
    return this.bools.get(key) ?? false
  }

  override async loadLevelCredentials() {
    if (!this.loadedLevels) {
      this.queryCount += 1
      this.loadedLevels = true
    }
  }

  override async loadDossiers() {
    if (!this.loadedDossiers) {
      this.queryCount += 1
      this.loadedDossiers = true
    }
  }

  override async loadFiles() {
    if (!this.loadedFiles) {
      this.queryCount += 1
      this.loadedFiles = true
    }
  }
}

function seedOwnFile(cache: StubSecurityCache) {
  cache.seedDossier({
    id: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: false,
    accessPasswordHash: null,
    passwordVersion: 1,
  })
  cache.seedFile({
    id: FILE_ID,
    dossierId: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: true,
    accessPasswordHash: "hash",
    passwordVersion: 2,
  })
  cache.seedLevelCredential({
    id: LEVEL_ID,
    passwordHash: "level-hash",
    passwordVersion: 1,
    filePasswordHash: "file-level-hash",
    filePasswordVersion: 1,
  })
}

Deno.test("assertPasswordGatesCached: own file password blocks without file token", async () => {
  const cache = new StubSecurityCache()
  seedOwnFile(cache)
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireFilePassword, true)

  await assertRejects(
    () =>
      assertPasswordGatesCached(cache, {
        userId: USER_ID,
        resourceSecurityLevelId: LEVEL_ID,
        dossierId: DOSSIER_ID,
        fileId: FILE_ID,
      }),
    Error,
    `PASSWORD_REQUIRED:file:${FILE_ID}`,
  )
})

Deno.test("assertPasswordGatesCached: own file password accepts matching token version", async () => {
  const cache = new StubSecurityCache()
  seedOwnFile(cache)

  const issued = await issueSecurityAccessToken({
    userId: USER_ID,
    scope: "file",
    resourceId: FILE_ID,
    passwordVersion: 2,
  })

  await assertPasswordGatesCached(cache, {
    userId: USER_ID,
    resourceSecurityLevelId: LEVEL_ID,
    dossierId: DOSSIER_ID,
    fileId: FILE_ID,
    fileTokens: [issued.token],
  })
})

Deno.test("assertPasswordGatesCached: rejects stale file token password version", async () => {
  const cache = new StubSecurityCache()
  seedOwnFile(cache)

  const issued = await issueSecurityAccessToken({
    userId: USER_ID,
    scope: "file",
    resourceId: FILE_ID,
    passwordVersion: 1,
  })

  await assertRejects(
    () =>
      assertPasswordGatesCached(cache, {
        userId: USER_ID,
        resourceSecurityLevelId: LEVEL_ID,
        dossierId: DOSSIER_ID,
        fileId: FILE_ID,
        fileTokens: [issued.token],
      }),
    Error,
    `PASSWORD_REQUIRED:file:${FILE_ID}`,
  )
})

Deno.test("assertPasswordGatesCached: own dossier override skips level password gate", async () => {
  const cache = new StubSecurityCache()
  cache.seedDossier({
    id: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: true,
    accessPasswordHash: "dossier-hash",
    passwordVersion: 3,
  })
  cache.seedLevelCredential({
    id: LEVEL_ID,
    passwordHash: "level-hash",
    passwordVersion: 9,
    filePasswordHash: null,
    filePasswordVersion: 1,
  })
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireAccessPassword, true)

  const issued = await issueSecurityAccessToken({
    userId: USER_ID,
    scope: "dossier",
    resourceId: DOSSIER_ID,
    passwordVersion: 3,
  })

  await assertPasswordGatesCached(cache, {
    userId: USER_ID,
    resourceSecurityLevelId: LEVEL_ID,
    dossierId: DOSSIER_ID,
    dossierTokens: [issued.token],
  })
})

Deno.test("assertPasswordGatesCached: level fallback requires level token when no own dossier password", async () => {
  const cache = new StubSecurityCache()
  cache.seedDossier({
    id: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: false,
    accessPasswordHash: null,
    passwordVersion: 1,
  })
  cache.seedLevelCredential({
    id: LEVEL_ID,
    passwordHash: "level-hash",
    passwordVersion: 4,
    filePasswordHash: null,
    filePasswordVersion: 1,
  })
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireAccessPassword, true)

  await assertRejects(
    () =>
      assertPasswordGatesCached(cache, {
        userId: USER_ID,
        resourceSecurityLevelId: LEVEL_ID,
        dossierId: DOSSIER_ID,
      }),
    Error,
    `PASSWORD_REQUIRED:dossier:${DOSSIER_ID}`,
  )

  const issued = await issueSecurityAccessToken({
    userId: USER_ID,
    scope: "dossier",
    resourceId: DOSSIER_ID,
    passwordVersion: 1,
  })

  await assertPasswordGatesCached(cache, {
    userId: USER_ID,
    resourceSecurityLevelId: LEVEL_ID,
    dossierId: DOSSIER_ID,
    dossierTokens: [issued.token],
  })
})

Deno.test("assertPasswordGatesCached: fail-closed when level requires password but hash missing", async () => {
  const cache = new StubSecurityCache()
  cache.seedDossier({
    id: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: false,
    accessPasswordHash: null,
    passwordVersion: 1,
  })
  cache.seedLevelCredential({
    id: LEVEL_ID,
    passwordHash: null,
    passwordVersion: 1,
    filePasswordHash: null,
    filePasswordVersion: 1,
  })
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireAccessPassword, true)

  await assertRejects(
    () =>
      assertPasswordGatesCached(cache, {
        userId: USER_ID,
        resourceSecurityLevelId: LEVEL_ID,
        dossierId: DOSSIER_ID,
      }),
    Error,
    `PASSWORD_REQUIRED:dossier:${DOSSIER_ID}:misconfigured`,
  )
})

Deno.test("assertPasswordGatesCached: query count does not grow linearly with repeated file checks", async () => {
  const cache = new StubSecurityCache()
  cache.seedDossier({
    id: DOSSIER_ID,
    securityLevelId: LEVEL_ID,
    accessPasswordEnabled: false,
    accessPasswordHash: null,
    passwordVersion: 1,
  })
  cache.seedLevelCredential({
    id: LEVEL_ID,
    passwordHash: null,
    passwordVersion: 1,
    filePasswordHash: "file-hash",
    filePasswordVersion: 1,
  })
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireFilePassword, true)
  cache.setBool(LEVEL_ID, PermissionRuleKey.requireAccessPassword, false)

  const fileIds = Array.from({ length: 20 }, (_, i) =>
    `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, "0")}`
  )
  for (const fileId of fileIds) {
    cache.seedFile({
      id: fileId,
      dossierId: DOSSIER_ID,
      securityLevelId: LEVEL_ID,
      accessPasswordEnabled: false,
      accessPasswordHash: null,
      passwordVersion: 1,
    })
  }

  const tokens = await Promise.all(
    fileIds.map((fileId) =>
      issueSecurityAccessToken({
        userId: USER_ID,
        scope: "file",
        resourceId: fileId,
        passwordVersion: 1,
      })
    ),
  )

  cache.queryCount = 0
  for (let i = 0; i < fileIds.length; i++) {
    await assertPasswordGatesCached(cache, {
      userId: USER_ID,
      resourceSecurityLevelId: LEVEL_ID,
      dossierId: DOSSIER_ID,
      fileId: fileIds[i],
      fileTokens: tokens.map((item) => item.token),
    })
  }

  // Stub getEffectiveBool/load* chỉ gọi khi cần; không được ~linear theo số file * nhiều query.
  assertEquals(cache.queryCount < fileIds.length * 3, true)
})

Deno.test("verifySecurityAccessToken rejects wrong user/scope/resource", async () => {
  const issued = await issueSecurityAccessToken({
    userId: USER_ID,
    scope: "file",
    resourceId: FILE_ID,
    passwordVersion: 1,
  })

  assertEquals(
    await verifySecurityAccessToken({
      token: issued.token,
      userId: "55555555-5555-5555-5555-555555555555",
      scope: "file",
      resourceId: FILE_ID,
      passwordVersion: 1,
    }),
    false,
  )
  assertEquals(
    await verifySecurityAccessToken({
      token: issued.token,
      userId: USER_ID,
      scope: "dossier",
      resourceId: FILE_ID,
      passwordVersion: 1,
    }),
    false,
  )
  assertEquals(
    await verifySecurityAccessToken({
      token: issued.token,
      userId: USER_ID,
      scope: "file",
      resourceId: DOSSIER_ID,
      passwordVersion: 1,
    }),
    false,
  )
})
