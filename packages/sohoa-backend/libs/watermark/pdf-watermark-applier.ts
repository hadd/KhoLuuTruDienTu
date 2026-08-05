import { PDFDocument, rgb, degrees } from "pdf-lib";
import type {
  WatermarkPosition,
  WatermarkStamp,
} from "../../db/schemas/watermark.ts";
import {
  flattenPdfPagesToImages,
  isWatermarkFlattenEnabled,
} from "./pdf-page-flattener.ts";
import { embedWatermarkFont } from "./watermark-font.ts";

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
  const cx = pageWidth * xPct;
  const cy = pageHeight * (1 - yPct);
  // Do not clamp to page boundaries, so center exactly matches FE coordinate
  const x = cx - boxWidth / 2;
  const y = cy - boxHeight / 2;
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

  // Map exactly to frontend preset percentages
  switch (position) {
    case "top_left":
      return customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, 8, 8, rotationDegrees);
    case "top_right":
      return customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, 92, 8, rotationDegrees);
    case "bottom_left":
      return customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, 8, 92, rotationDegrees);
    case "bottom_right":
      return customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, 92, 92, rotationDegrees);
    case "center":
    case "tile_grid":
    case "custom":
    default:
      return customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, 50, 50, rotationDegrees);
  }
}

function tileOrigins(
  pageWidth: number,
  pageHeight: number,
  boxWidth: number,
  boxHeight: number,
  rotationDegrees: number,
): Point[] {
  // Map exactly to frontend tilePositions
  const positions = [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 25, y: 75 },
    { x: 75, y: 75 },
    { x: 50, y: 50 },
  ];
  return positions.map(pos => 
    customOrigin(pageWidth, pageHeight, boxWidth, boxHeight, pos.x, pos.y, rotationDegrees)
  );
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
      ),
    );
  }

  if (position === "tile_grid") {
    return tileOrigins(
      pageWidth,
      pageHeight,
      boxWidth,
      boxHeight,
      defaultRotation,
    );
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

function defaultTextRotation(
  position: WatermarkPosition,
  configured: number,
): number {
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
  const needsImage =
    config.imageEnabled && Boolean(config.imagePngBytes?.byteLength);
  if (!needsText && !needsImage) {
    return pdfBytes;
  }

  // Load without copying when already a standalone Uint8Array (avoids ~1x PDF RAM).
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
  });
  const pages = pdfDoc.getPages();
  const font = needsText
    ? await embedWatermarkFont(pdfDoc)
    : null;
  const embeddedImage =
    needsImage && config.imagePngBytes
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
        const cx = origin.x + drawWidth / 2;
        const cy = origin.y + drawHeight / 2;
        const theta = (origin.rotationDegrees * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rotatedX = (drawWidth / 2) * cos - (drawHeight / 2) * sin;
        const rotatedY = (drawWidth / 2) * sin + (drawHeight / 2) * cos;

        page.drawImage(embeddedImage, {
          x: cx - rotatedX,
          y: cy - rotatedY,
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
        const cx = origin.x + textWidth / 2;
        const cy = origin.y + textHeight / 2;
        const theta = (origin.rotationDegrees * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rotatedX = (textWidth / 2) * cos - (textHeight / 2) * sin;
        const rotatedY = (textWidth / 2) * sin + (textHeight / 2) * cos;

        page.drawText(text, {
          x: cx - rotatedX,
          y: cy - rotatedY,
          size: fontSize,
          font,
          color: rgb(0.45, 0.45, 0.45),
          opacity,
          rotate: degrees(origin.rotationDegrees),
        });
      }
    }
  }

  const stamped = await pdfDoc.save();
  // Bake watermark into page images so editors (e.g. Google Docs) cannot
  // delete/edit the watermark as a separate object.
  if (!isWatermarkFlattenEnabled()) {
    return stamped;
  }
  return await flattenPdfPagesToImages(stamped);
}
