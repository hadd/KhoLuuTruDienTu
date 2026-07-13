import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import type { WatermarkPosition, WatermarkStamp } from "../../db/schemas/watermark.ts";

export type WatermarkApplyConfig = {
    textEnabled: boolean;
    textContent: string | null;
    textOpacity: number;
    textPosition: WatermarkPosition;
    textSizePercent: number;
    textOffsetXPercent: number | null;
    textOffsetYPercent: number | null;
    textRotationDegrees: number;
    textStamps: WatermarkStamp[] | null;
    imageEnabled: boolean;
    imageOpacity: number;
    imagePosition: WatermarkPosition;
    imageSizePercent: number;
    imageOffsetXPercent: number | null;
    imageOffsetYPercent: number | null;
    imageRotationDegrees: number;
    imageStamps: WatermarkStamp[] | null;
    /** PNG bytes used for embedding (original PNG or rasterized SVG) */
    imagePngBytes: Uint8Array | null;
};

type Point = { x: number; y: number; rotationDegrees: number };

function clampOpacity(percent: number): number {
    const n = Number.isFinite(percent) ? percent : 30;
    return Math.min(50, Math.max(5, n)) / 100;
}

function clampSizePercent(percent: number): number {
    const n = Number.isFinite(percent) ? percent : 30;
    return Math.min(100, Math.max(5, n)) / 100;
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

function clampRotation(value: number | undefined, fallback: number): number {
    const n = value === undefined || !Number.isFinite(value) ? fallback : value;
    return Math.min(180, Math.max(-180, n));
}

/** FE top-left origin (%) → PDF bottom-left origin (points). */
function customOrigin(
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
    offsetXPercent: number,
    offsetYPercent: number,
    rotationDegrees: number,
): Point {
    const xPct = clampPercent(offsetXPercent) / 100;
    const yPct = clampPercent(offsetYPercent) / 100;
    let x = pageWidth * xPct;
    let y = pageHeight * (1 - yPct) - boxHeight;
    x = Math.min(Math.max(0, x), Math.max(0, pageWidth - boxWidth));
    y = Math.min(Math.max(0, y), Math.max(0, pageHeight - boxHeight));
    return { x, y, rotationDegrees };
}

function resolveAnchor(
    position: WatermarkPosition,
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
    offsetXPercent: number | null,
    offsetYPercent: number | null,
    rotationDegrees: number,
    margin = 24,
): Point {
    if (
        position === "custom" &&
        offsetXPercent !== null &&
        offsetYPercent !== null
    ) {
        return customOrigin(
            pageWidth,
            pageHeight,
            boxWidth,
            boxHeight,
            offsetXPercent,
            offsetYPercent,
            rotationDegrees,
        );
    }

    switch (position) {
        case "top_left":
            return {
                x: margin,
                y: pageHeight - boxHeight - margin,
                rotationDegrees,
            };
        case "top_right":
            return {
                x: pageWidth - boxWidth - margin,
                y: pageHeight - boxHeight - margin,
                rotationDegrees,
            };
        case "bottom_left":
            return { x: margin, y: margin, rotationDegrees };
        case "bottom_right":
            return {
                x: pageWidth - boxWidth - margin,
                y: margin,
                rotationDegrees,
            };
        case "center":
        case "tile_grid":
        case "custom":
        default:
            return {
                x: (pageWidth - boxWidth) / 2,
                y: (pageHeight - boxHeight) / 2,
                rotationDegrees,
            };
    }
}

function tileOrigins(
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
    rotationDegrees: number,
): Point[] {
    const gapX = Math.max(boxWidth * 0.35, 40);
    const gapY = Math.max(boxHeight * 0.35, 40);
    const stepX = boxWidth + gapX;
    const stepY = boxHeight + gapY;
    const points: Point[] = [];

    for (let y = gapY / 2; y < pageHeight; y += stepY) {
        for (let x = gapX / 2; x < pageWidth; x += stepX) {
            points.push({ x, y, rotationDegrees });
        }
    }

    return points.length > 0
        ? points
        : [{
            x: (pageWidth - boxWidth) / 2,
            y: (pageHeight - boxHeight) / 2,
            rotationDegrees,
        }];
}

function resolveDrawPoints(
    position: WatermarkPosition,
    stamps: WatermarkStamp[] | null,
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
    offsetXPercent: number | null,
    offsetYPercent: number | null,
    defaultRotation: number,
): Point[] {
    if (stamps && stamps.length > 0) {
        return stamps.map((stamp) =>
            customOrigin(
                pageWidth,
                pageHeight,
                boxWidth,
                boxHeight,
                stamp.offsetXPercent,
                stamp.offsetYPercent,
                clampRotation(stamp.rotationDegrees, defaultRotation),
            )
        );
    }

    if (position === "tile_grid") {
        return tileOrigins(pageWidth, pageHeight, boxWidth, boxHeight, defaultRotation);
    }

    return [
        resolveAnchor(
            position,
            pageWidth,
            pageHeight,
            boxWidth,
            boxHeight,
            offsetXPercent,
            offsetYPercent,
            defaultRotation,
        ),
    ];
}

function defaultTextRotation(position: WatermarkPosition, configured: number): number {
    if (position === "tile_grid" && configured === 0) {
        return -30;
    }
    return configured;
}

export async function applyWatermarkToPdfBytes(
    pdfBytes: Uint8Array,
    config: WatermarkApplyConfig,
): Promise<Uint8Array> {
    const needsText = config.textEnabled && Boolean(config.textContent?.trim());
    const needsImage = config.imageEnabled && Boolean(config.imagePngBytes?.byteLength);
    if (!needsText && !needsImage) {
        return pdfBytes;
    }

    const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBytes), { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = needsText ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null;
    const embeddedImage = needsImage && config.imagePngBytes
        ? await pdfDoc.embedPng(new Uint8Array(config.imagePngBytes))
        : null;

    for (const page of pages) {
        const { width, height } = page.getSize();

        if (embeddedImage) {
            const sizeRatio = clampSizePercent(config.imageSizePercent);
            const targetWidth = width * sizeRatio;
            const scale = targetWidth / embeddedImage.width;
            const drawWidth = embeddedImage.width * scale;
            const drawHeight = embeddedImage.height * scale;
            const opacity = clampOpacity(config.imageOpacity);
            const imageRotation = clampRotation(config.imageRotationDegrees, 0);

            const origins = resolveDrawPoints(
                config.imagePosition,
                config.imageStamps,
                width,
                height,
                drawWidth,
                drawHeight,
                config.imageOffsetXPercent,
                config.imageOffsetYPercent,
                imageRotation,
            );

            for (const origin of origins) {
                page.drawImage(embeddedImage, {
                    x: origin.x,
                    y: origin.y,
                    width: drawWidth,
                    height: drawHeight,
                    opacity,
                    rotate: degrees(origin.rotationDegrees),
                });
            }
        }

        if (font && config.textContent?.trim()) {
            const text = config.textContent.trim();
            const sizeRatio = clampSizePercent(config.textSizePercent);
            const fontSize = Math.max(8, width * sizeRatio * 0.35);
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textHeight = font.heightAtSize(fontSize);
            const opacity = clampOpacity(config.textOpacity);
            const textRotation = defaultTextRotation(
                config.textPosition,
                clampRotation(config.textRotationDegrees, 0),
            );

            const origins = resolveDrawPoints(
                config.textPosition,
                config.textStamps,
                width,
                height,
                textWidth,
                textHeight,
                config.textOffsetXPercent,
                config.textOffsetYPercent,
                textRotation,
            );

            for (const origin of origins) {
                page.drawText(text, {
                    x: origin.x,
                    y: origin.y,
                    size: fontSize,
                    font,
                    color: rgb(0.45, 0.45, 0.45),
                    opacity,
                    rotate: degrees(origin.rotationDegrees),
                });
            }
        }
    }

    return await pdfDoc.save();
}
