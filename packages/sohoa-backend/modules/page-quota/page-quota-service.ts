import { eq, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { pageQuota, pageQuotaCharges } from "../../db/schemas/page-quota.ts";
import { env } from "../../env.ts";
import {
  downloadJsonFromStorage,
  resolveMetadataJsonKey,
} from "../data-entry/data-entry-s3-utils.ts";
import {
  countExtractedPages,
  sumChargedPages,
  sumPendingUnchargedPages,
} from "./page-quota-count.ts";
import {
  canonicalizeLicensePayload,
  hmacUsedPages,
  hmacUsedPagesOk,
  LicenseCryptoError,
  parseLicenseFile,
  verifyLicenseFile,
  type PageLicenseFile,
  type PageLicensePayload,
} from "./page-quota-crypto.ts";
import { EMBEDDED_PAGE_QUOTA_PUBLIC_KEY_B64 } from "./page-quota-public-key.ts";

export const PAGE_QUOTA_UPLOAD_EXCEEDED = "PAGE_QUOTA_UPLOAD_EXCEEDED";

export type PageQuotaView = {
  usedPages: number;
  pendingPages: number;
  pageLimit: number | null;
  remaining: number | null;
  routingStopped: boolean;
  customer: string | null;
  licenseIssuedAt: string | null;
  hasLicense: boolean;
  enforced: boolean;
  integrityOk: boolean;
};

export type PageQuotaGate = {
  allowed: boolean;
  usedPages: number;
  pageLimit: number;
  reason: string;
};

function isPageQuotaEnforced(): boolean {
  return env.PAGE_QUOTA_ENFORCE;
}

function publicKeyB64(): string {
  const fromEnv = Deno.env.get("PAGE_QUOTA_PUBLIC_KEY")?.trim();
  if (fromEnv) return fromEnv;
  return EMBEDDED_PAGE_QUOTA_PUBLIC_KEY_B64;
}

function assertPublicKeyConfigured(): void {
  const key = publicKeyB64();
  if (!key || key.includes("REPLACE_WITH_GEN_KEYS_OUTPUT")) {
    throw new LicenseCryptoError(
      "Public key chưa cấu hình. Chạy page-license:gen-keys và dán vào page-quota-public-key.ts",
    );
  }
}

async function ensureQuotaRow() {
  const existing = await db.query.pageQuota.findFirst();
  if (existing) return existing;
  const [created] = await db
    .insert(pageQuota)
    .values({ usedPages: 0 })
    .returning();
  return created;
}

async function storedLicenseFile(
  row: typeof pageQuota.$inferSelect,
): Promise<PageLicenseFile | null> {
  if (!row.licensePayload || !row.licenseSig) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(row.licensePayload);
  } catch {
    return null;
  }
  try {
    return parseLicenseFile({ payload, sig: row.licenseSig });
  } catch {
    return null;
  }
}

async function verifiedPayload(
  row: typeof pageQuota.$inferSelect,
): Promise<PageLicensePayload | null> {
  const file = await storedLicenseFile(row);
  if (!file) return null;
  try {
    assertPublicKeyConfigured();
    const ok = await verifyLicenseFile(file, publicKeyB64());
    if (!ok) return null;
    return file.payload;
  } catch (error) {
    if (error instanceof LicenseCryptoError) return null;
    throw error;
  }
}

export async function getPageQuotaView(): Promise<PageQuotaView> {
  const row = await ensureQuotaRow();
  const enforced = isPageQuotaEnforced();
  const payload = await verifiedPayload(row);
  const charged = await sumChargedPages();
  const hmacOk = payload
    ? hmacUsedPagesOk(payload.macSalt, row.usedPages, row.usedPagesHmac)
    : false;
  const integrityOk = Boolean(payload) && hmacOk;
  const usedPages = integrityOk ? Math.max(row.usedPages, charged) : charged;
  const pendingPages = await sumPendingUnchargedPages();
  const pageLimit = payload?.pageLimit ?? null;
  const remaining =
    pageLimit == null ? null : Math.max(0, pageLimit - usedPages);
  const routingStopped = enforced
    ? !payload || !hmacOk || (pageLimit != null && usedPages >= pageLimit)
    : false;

  return {
    usedPages,
    pendingPages,
    pageLimit,
    remaining,
    routingStopped,
    customer: payload?.customer ?? row.licenseCustomer ?? null,
    licenseIssuedAt:
      payload?.issuedAt ?? row.licenseIssuedAt?.toISOString() ?? null,
    hasLicense: Boolean(payload),
    enforced,
    integrityOk,
  };
}

export async function assertExtractRoutingAllowed(): Promise<PageQuotaGate> {
  const enforced = isPageQuotaEnforced();
  if (!enforced) {
    const view = await getPageQuotaView();
    return {
      allowed: true,
      usedPages: view.usedPages,
      pageLimit: view.pageLimit ?? Number.MAX_SAFE_INTEGER,
      reason: "PAGE_QUOTA_ENFORCE=false",
    };
  }

  const row = await ensureQuotaRow();
  const payload = await verifiedPayload(row);
  if (!payload) {
    return {
      allowed: false,
      usedPages: row.usedPages,
      pageLimit: 0,
      reason: "PAGE_QUOTA_NO_LICENSE",
    };
  }
  if (!hmacUsedPagesOk(payload.macSalt, row.usedPages, row.usedPagesHmac)) {
    return {
      allowed: false,
      usedPages: row.usedPages,
      pageLimit: payload.pageLimit,
      reason: "PAGE_QUOTA_INTEGRITY",
    };
  }
  const charged = await sumChargedPages();
  const usedPages = Math.max(row.usedPages, charged);
  if (usedPages >= payload.pageLimit) {
    return {
      allowed: false,
      usedPages,
      pageLimit: payload.pageLimit,
      reason: "PAGE_QUOTA_EXCEEDED",
    };
  }
  return {
    allowed: true,
    usedPages,
    pageLimit: payload.pageLimit,
    reason: "ok",
  };
}

export type PageQuotaUploadCheck = {
  allowed: boolean;
  pages: number;
  remaining: number | null;
  usedPages: number;
  pageLimit: number | null;
  message: string | null;
};

function uploadExceededMessage(pages: number, remaining: number): string {
  return `Không đủ hạn mức bóc tách: lượt tải có ${pages} trang, chỉ còn ${remaining} trang. Hãy nạp thêm license hoặc giảm số trang.`;
}

/** Kiểm tra tổng trang của cả lượt tải so với số trang còn lại (limit - đã làm). */
export async function checkUploadPages(
  pages: number,
): Promise<PageQuotaUploadCheck> {
  const requested = Number.isFinite(pages) ? Math.max(0, Math.floor(pages)) : 0;
  const view = await getPageQuotaView();
  if (view.remaining == null) {
    return {
      allowed: true,
      pages: requested,
      remaining: null,
      usedPages: view.usedPages,
      pageLimit: view.pageLimit,
      message: null,
    };
  }
  if (requested <= 0 || requested <= view.remaining) {
    return {
      allowed: true,
      pages: requested,
      remaining: view.remaining,
      usedPages: view.usedPages,
      pageLimit: view.pageLimit,
      message: null,
    };
  }
  return {
    allowed: false,
    pages: requested,
    remaining: view.remaining,
    usedPages: view.usedPages,
    pageLimit: view.pageLimit,
    message: uploadExceededMessage(requested, view.remaining),
  };
}

export async function assertUploadFitsRemaining(pages: number): Promise<void> {
  const check = await checkUploadPages(pages);
  if (check.allowed) return;

  throw httpError.forbidden(
    check.message ??
      uploadExceededMessage(check.pages, check.remaining ?? 0),
    {
      code: PAGE_QUOTA_UPLOAD_EXCEEDED,
      message:
        check.message ??
        uploadExceededMessage(check.pages, check.remaining ?? 0),
      pages: check.pages,
      remaining: check.remaining,
      usedPages: check.usedPages,
      pageLimit: check.pageLimit,
    },
  );
}

export async function applyPageLicense(
  raw: unknown,
  actorId: string | null,
): Promise<PageQuotaView> {
  let file: PageLicenseFile;
  try {
    file = parseLicenseFile(raw);
  } catch {
    throw httpError.badRequest("File license không hợp lệ");
  }

  const sigOk = await (async () => {
    try {
      assertPublicKeyConfigured();
      return await verifyLicenseFile(file, publicKeyB64());
    } catch (error) {
      if (error instanceof LicenseCryptoError) {
        throw httpError.badRequest(error.message);
      }
      throw error;
    }
  })();
  if (!sigOk) {
    throw httpError.badRequest("Chữ ký license không hợp lệ");
  }

  const issuedAt = new Date(file.payload.issuedAt);
  if (Number.isNaN(issuedAt.getTime())) {
    throw httpError.badRequest("issuedAt không hợp lệ");
  }

  await db.transaction(async (tx) => {
    await ensureQuotaRow();
    const [locked] = await tx.select().from(pageQuota).limit(1).for("update");
    if (!locked) {
      throw httpError.internal("page_quota row missing");
    }

    if (
      locked.licenseIssuedAt &&
      issuedAt.getTime() <= locked.licenseIssuedAt.getTime()
    ) {
      throw httpError.badRequest(
        "License cũ hơn bản đang áp dụng — từ chối (không rollback hạn mức)",
      );
    }

    const currentPayload = await verifiedPayload(locked);
    const hmacOk = currentPayload
      ? hmacUsedPagesOk(
          currentPayload.macSalt,
          locked.usedPages,
          locked.usedPagesHmac,
        )
      : false;

    const [sumRow] = await tx
      .select({
        total: sql<number>`coalesce(sum(${pageQuotaCharges.pages}), 0)`,
      })
      .from(pageQuotaCharges);
    const charged = Number(sumRow?.total ?? 0);
    const usedPages = hmacOk ? Math.max(locked.usedPages, charged) : charged;

    await tx
      .update(pageQuota)
      .set({
        usedPages,
        usedPagesHmac: hmacUsedPages(file.payload.macSalt, usedPages),
        pageLimit: file.payload.pageLimit,
        licensePayload: canonicalizeLicensePayload(file.payload),
        licenseSig: file.sig,
        licenseIssuedAt: issuedAt,
        licenseId: file.payload.licenseId,
        licenseCustomer: file.payload.customer,
        appliedById: actorId,
        updatedAt: new Date(),
      })
      .where(eq(pageQuota.id, locked.id));
  });

  return await getPageQuotaView();
}

export async function chargeDossierExtractPages(input: {
  dossierId: string;
  ocrMetadataKey: string;
}): Promise<number> {
  const existing = await db.query.pageQuotaCharges.findFirst({
    where: eq(pageQuotaCharges.dossierId, input.dossierId),
  });
  if (existing) return existing.pages;

  let pages = 1;
  try {
    const jsonKey = resolveMetadataJsonKey(input.ocrMetadataKey);
    const raw = await downloadJsonFromStorage(jsonKey);
    pages = await countExtractedPages({
      dossierId: input.dossierId,
      metadata: raw,
    });
  } catch (error) {
    console.warn(
      `[PageQuota] Failed to parse extract JSON for dossier=${input.dossierId}, fallback files.page_count`,
      error,
    );
    pages = await countExtractedPages({
      dossierId: input.dossierId,
      metadata: { metadata_groups: [] },
    });
  }

  await db.transaction(async (tx) => {
    await ensureQuotaRow();
    const [locked] = await tx.select().from(pageQuota).limit(1).for("update");
    if (!locked) {
      throw httpError.internal("page_quota row missing");
    }

    const already = await tx.query.pageQuotaCharges.findFirst({
      where: eq(pageQuotaCharges.dossierId, input.dossierId),
    });
    if (already) return;

    await tx.insert(pageQuotaCharges).values({
      dossierId: input.dossierId,
      pages,
    });

    const payload = await verifiedPayload(locked);
    const nextUsed = locked.usedPages + pages;
    await tx
      .update(pageQuota)
      .set({
        usedPages: nextUsed,
        usedPagesHmac: payload
          ? hmacUsedPages(payload.macSalt, nextUsed)
          : locked.usedPagesHmac,
        updatedAt: new Date(),
      })
      .where(eq(pageQuota.id, locked.id));
  });

  return pages;
}
