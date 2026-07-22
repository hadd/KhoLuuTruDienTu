import { Elysia } from "elysia"
import { plugins } from "../libs/plugins/_index.ts"
import { createProfileRouter } from "../modules/profile/profile.router.ts"
import { createDossierRouter } from "../modules/dossier/index.ts"
import { createFolderRouter } from "../modules/folder/index.ts"
import { createDataEntryRouter } from "../modules/data-entry/index.ts"
import { createIssueReportRouter } from "../modules/issue-report/index.ts"
import { createOcrCallbackRouter } from "../modules/ocr-callback/index.ts"
import { createMetadataHistoryRouter } from "../modules/metadata-history/metadata-history.router.ts"
import { createWorkflowLogRouter } from "../modules/workflow-log/workflow-log.router.ts"
import { createDashboardRouter } from "../modules/dashboard/index.ts"
import { createScanIntakeRouter } from "../modules/scan-intake/index.ts"
import { createDigitalSignRouter } from "../modules/digital-sign/index.ts"
import { createFondRouter } from "../modules/fond/index.ts"
import { createRetentionPeriodRouter } from "../modules/retention-period/index.ts"
import { createInventoryRouter } from "../modules/inventory/index.ts"
import { createDossierTypeRouter } from "../modules/dossier-type/index.ts"
import { createDocumentTypeRouter } from "../modules/document-type/index.ts"
import { createProjectPlanRouter } from "../modules/project-plan/index.ts"
import { createPaperSizeRouter, createPaperPlanRouter } from "../modules/paper-size/index.ts"
import { createArchiveSubmissionRouter, createArchiveWarehouseRouter } from "../modules/archive/index.ts"
import { createSearchRouter } from "../modules/search/index.ts"
import { createNotificationRouter } from "../modules/notification/notification.router.ts"
import { createPhysicalWarehouseRouter } from "../modules/physical-warehouse/index.ts"
import { createSecurityLevelRouter } from "../modules/security-level/index.ts"

export const apiV1Router = new Elysia({
    prefix: "/api/v1",
})
    // .use(plugins.authProfile)
    .use(createProfileRouter("/users"))
    .use(createDossierRouter("/dossiers"))
    
    .use(createScanIntakeRouter("/scan-intake"))
    .use(createDigitalSignRouter("/digital-sign"))
    .use(createFolderRouter("/folders"))
    .use(createFondRouter("/fonds"))
    .use(createRetentionPeriodRouter("/retention-periods"))
    .use(createInventoryRouter("/inventories"))
    .use(createDossierTypeRouter("/dossier-types"))
    .use(createDocumentTypeRouter("/document-types"))
    .use(createPhysicalWarehouseRouter("/physical-warehouse"))
    .use(createDataEntryRouter("/data-entry"))
    .use(createIssueReportRouter("/issue-reports"))
    .use(createDashboardRouter("/dashboard"))
    .use(createOcrCallbackRouter("/internal"))
    .use(createProjectPlanRouter())
    .use(createPaperSizeRouter())
    .use(createPaperPlanRouter())
    .use(createMetadataHistoryRouter())
    .use(createWorkflowLogRouter())
    .use(createNotificationRouter())
    .use(createArchiveSubmissionRouter("/archive-submissions"))
    .use(createArchiveWarehouseRouter("/archive-warehouse"))
    .use(createSearchRouter("/search"))
    .use(createSecurityLevelRouter("/security-levels"))
