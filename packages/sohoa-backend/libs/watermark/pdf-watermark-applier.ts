import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import type { WatermarkPosition } from "../../db/schemas/watermark.ts";

export type WatermarkApplyConfig = {
    textEnabled: boolean;
    textContent: string | null;
    textOpacity: number;
    textPosition: WatermarkPosition;
    textSizePercent: number;
    imageEnabled: boolean;
    imageOpacity: number;
    imagePosition: WatermarkPosition;
    imageSizePercent: number;
    /** PNG bytes used for embedding (original PNG or rasterized SVG) */
    imagePngBytes: Uint8Array | null;
};

type Point = { x: number; y: number };

function clampOpacity(percent: number): number {
    const n = Number.isFinite(percent) ? percent : 30;
    return Math.min(50, Math.max(5, n)) / 100;
}

function clampSizePercent(percent: number): number {
    const n = Number.isFinite(percent) ? percent : 30;
    return Math.min(100, Math.max(5, n)) / 100;
}

function resolveAnchor(
    position: WatermarkPosition,
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
    margin = 24,
): Point {
    switch (position) {
        case "top_left":
            return { x: margin, y: pageHeight - boxHeight - margin };
        case "top_right":
            return { x: pageWidth - boxWidth - margin, y: pageHeight - boxHeight - margin };
        case "bottom_left":
            return { x: margin, y: margin };
        case "bottom_right":
            return { x: pageWidth - boxWidth - margin, y: margin };
        case "center":
        case "tile_grid":
        default:
            return {
                x: (pageWidth - boxWidth) / 2,
                y: (pageHeight - boxHeight) / 2,
            };
    }
}

function tileOrigins(
    pageWidth: number,
    pageHeight: number,
    boxWidth: number,
    boxHeight: number,
): Point[] {
    const gapX = Math.max(boxWidth * 0.35, 40);
    const gapY = Math.max(boxHeight * 0.35, 40);
    const stepX = boxWidth + gapX;
    const stepY = boxHeight + gapY;
    const points: Point[] = [];

    for (let y = gapY / 2; y < pageHeight; y += stepY) {
        for (let x = gapX / 2; x < pageWidth; x += stepX) {
            points.push({ x, y });
        }
    }

    return points.length > 0 ? points : [{ x: (pageWidth - boxWidth) / 2, y: (pageHeight - boxHeight) / 2 }];
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

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = needsText ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null;
    const embeddedImage = needsImage && config.imagePngBytes
        ? await pdfDoc.embedPng(config.imagePngBytes)
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

            const origins = config.imagePosition === "tile_grid"
                ? tileOrigins(width, height, drawWidth, drawHeight)
                : [resolveAnchor(config.imagePosition, width, height, drawWidth, drawHeight)];

            for (const origin of origins) {
                page.drawImage(embeddedImage, {
                    x: origin.x,
                    y: origin.y,
                    width: drawWidth,
                    height: drawHeight,
                    opacity,
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

            const origins = config.textPosition === "tile_grid"
                ? tileOrigins(width, height, textWidth, textHeight)
                : [resolveAnchor(config.textPosition, width, height, textWidth, textHeight)];

            for (const origin of origins) {
                page.drawText(text, {
                    x: origin.x,
                    y: origin.y,
                    size: fontSize,
                    font,
                    color: rgb(0.45, 0.45, 0.45),
                    opacity,
                    rotate: degrees(config.textPosition === "tile_grid" ? -30 : 0),
                });
            }
        }
    }

    return await pdfDoc.save();
}
