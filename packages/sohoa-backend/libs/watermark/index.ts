export { applyWatermarkToPdfBytes } from "./pdf-watermark-applier.ts";
export { maybeWatermarkPdfFiles } from "./maybe-watermark-pdf-files.ts";
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
