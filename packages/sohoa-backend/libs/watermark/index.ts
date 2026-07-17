export { applyWatermarkToPdfBytes } from "./pdf-watermark-applier.ts";
export type { WatermarkApplyConfig } from "./pdf-watermark-applier.ts";
export {
    maybeWatermarkPdfFiles,
    resolveWatermarkApplyConfig,
    applyWatermarkConfigToPdfFiles,
    loadPdfSecurityRestrictions,
} from "./maybe-watermark-pdf-files.ts";
export type { WatermarkablePdfFile } from "./maybe-watermark-pdf-files.ts";
export {
    encryptPdfWithRestrictions,
    buildPdfPermissionFlags,
} from "./pdf-security.ts";
export type { PdfSecurityRestrictions } from "./pdf-security.ts";
export {
    validateWatermarkImageBytes,
    sanitizeSvgMarkup,
} from "./watermark-image-validator.ts";
export {
    getWatermarkStoragePrefix,
    getWatermarkImageMaxBytes,
    buildWatermarkAssetPrefix,
    buildWatermarkOriginalKey,
    buildWatermarkRasterKey,
    isWatermarkStorageKey,
} from "./watermark-storage-keys.ts";
