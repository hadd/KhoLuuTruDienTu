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
    .use(createDataEntryRouter("/data-entry"))
    .use(createIssueReportRouter("/issue-reports"))
    .use(createDashboardRouter("/dashboard"))
    .use(createOcrCallbackRouter("/internal"))
    .use(createMetadataHistoryRouter())
    .use(createWorkflowLogRouter())
