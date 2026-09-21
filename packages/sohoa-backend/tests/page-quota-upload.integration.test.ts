import { assertEquals, assertRejects } from "@std/assert";
import { AppError } from "@shared/common-lib";
import { eq } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { folders } from "../db/schemas/folder.ts";
import { pageQuota } from "../db/schemas/page-quota.ts";
import {
  DossierService,
  setStorageStatOverrideForTests,
} from "../modules/dossier/dossier-service.ts";
import {
  generatePageQuotaKeyPair,
  randomMacSaltB64,
  signLicensePayload,
} from "../modules/page-quota/page-quota-crypto.ts";
import {
  applyPageLicense,
  assertUploadFitsRemaining,
  checkUploadPages,
  getPageQuotaView,
  PAGE_QUOTA_UPLOAD_EXCEEDED,
} from "../modules/page-quota/page-quota-service.ts";
import { createTestProject, deleteTestProject } from "./test-project-helper.ts";

const TEST_PREFIX = `test-page-quota/${crypto.randomUUID()}`;

async function cleanupTestData(filePath: string, folderPath: string) {
  await db.delete(dossierFiles).where(eq(dossierFiles.filePath, filePath));
  await db.delete(dossiers).where(eq(dossiers.folderPath, folderPath));
  const segments = folderPath.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i--) {
    const segmentPath = segments.slice(0, i).join("/");
    await db.delete(folders).where(eq(folders.folderPath, segmentPath));
  }
}

Deno.test(
  {
    name: "Page quota upload remaining gate",
    sanitizeResources: false,
    sanitizeOps: false,
  },
  async (t) => {
    const project = await createTestProject();
    const fileKey = `${TEST_PREFIX}/ho-so/scan.pdf`;
    const folderPath = `${TEST_PREFIX}/ho-so`;
    const previousPublicKey = Deno.env.get("PAGE_QUOTA_PUBLIC_KEY");
    const originalQuota = await db.query.pageQuota.findFirst();

    setStorageStatOverrideForTests(async () => ({ fileSizeKb: 2 }));

    try {
      const pair = await generatePageQuotaKeyPair();
      Deno.env.set("PAGE_QUOTA_PUBLIC_KEY", pair.publicKeyB64);

      const baseline = await getPageQuotaView();
      const pageLimit = baseline.usedPages + 30;
      const license = await signLicensePayload(
        {
          v: 1,
          customer: "quota-upload-test",
          pageLimit,
          issuedAt: new Date(Date.now() + 86_400_000).toISOString(),
          licenseId: crypto.randomUUID(),
          macSalt: randomMacSaltB64(),
        },
        pair.privatePem,
      );
      await applyPageLicense(license, null);

      await t.step(
        "license remaining is 30 before extra pending files",
        async () => {
          const view = await getPageQuotaView();
          assertEquals(view.hasLicense, true);
          assertEquals(view.remaining, 30);
        },
      );

      await t.step("pending 10 pages does not reduce remaining", async () => {
        const created = await DossierService.createDocumentFromStorage({
          key: fileKey,
          projectCode: project.projectCode,
        });
        await db
          .update(dossierFiles)
          .set({ pageCount: 10 })
          .where(eq(dossierFiles.id, created.file.id));

        const view = await getPageQuotaView();
        assertEquals(view.remaining, 30);
        assertEquals(view.pendingPages, baseline.pendingPages + 10);
      });

      await t.step(
        "25 pages still fits because used pages remain 0",
        async () => {
          await assertUploadFitsRemaining(25);
          const check = await checkUploadPages(25);
          assertEquals(check.allowed, true);
          assertEquals(check.remaining, 30);
        },
      );

      await t.step("batch total 39 pages exceeds remaining 30", async () => {
        const check = await checkUploadPages(39);
        assertEquals(check.allowed, false);
        assertEquals(check.remaining, 30);
        assertEquals(check.pages, 39);
      });

      await t.step("31 pages exceeds remaining 30", async () => {
        const error = (await assertRejects(
          () => assertUploadFitsRemaining(31),
          AppError,
        )) as AppError;
        assertEquals(error.status, 403);
        assertEquals(
          (error.details as { code: string }).code,
          PAGE_QUOTA_UPLOAD_EXCEEDED,
        );
      });

      await t.step("5 pages fits remaining 30", async () => {
        await assertUploadFitsRemaining(5);
      });

      await t.step("no license skips the upload gate", async () => {
        const row = await db.query.pageQuota.findFirst();
        if (row) {
          await db
            .update(pageQuota)
            .set({
              licensePayload: null,
              licenseSig: null,
              licenseIssuedAt: null,
              licenseId: null,
              licenseCustomer: null,
              pageLimit: null,
              updatedAt: new Date(),
            })
            .where(eq(pageQuota.id, row.id));
        }
        await assertUploadFitsRemaining(25);
        const view = await getPageQuotaView();
        assertEquals(view.remaining, null);
      });
    } finally {
      setStorageStatOverrideForTests(null);
      await cleanupTestData(fileKey, folderPath);
      await deleteTestProject(project.projectCode);

      if (originalQuota) {
        await db
          .update(pageQuota)
          .set({
            usedPages: originalQuota.usedPages,
            usedPagesHmac: originalQuota.usedPagesHmac,
            pageLimit: originalQuota.pageLimit,
            licensePayload: originalQuota.licensePayload,
            licenseSig: originalQuota.licenseSig,
            licenseIssuedAt: originalQuota.licenseIssuedAt,
            licenseId: originalQuota.licenseId,
            licenseCustomer: originalQuota.licenseCustomer,
            appliedById: originalQuota.appliedById,
            updatedAt: originalQuota.updatedAt,
          })
          .where(eq(pageQuota.id, originalQuota.id));
      }

      if (previousPublicKey == null) {
        Deno.env.delete("PAGE_QUOTA_PUBLIC_KEY");
      } else {
        Deno.env.set("PAGE_QUOTA_PUBLIC_KEY", previousPublicKey);
      }
    }
  },
);
