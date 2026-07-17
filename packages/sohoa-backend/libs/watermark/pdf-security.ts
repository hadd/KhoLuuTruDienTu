import * as mupdf from "mupdf";
import { httpError, logApi } from "@shared/common-lib";
import { env } from "../../env.ts";

/**
 * Shared PDF document restrictions (Acrobat Document Restrictions Summary).
 * Applied after watermark + flatten when `enabled` is true.
 */
export type PdfSecurityRestrictions = {
  enabled: boolean;
  allowPrinting: boolean;
  allowChanging: boolean;
  allowDocumentAssembly: boolean;
  allowContentCopying: boolean;
  allowContentCopyingAccessibility: boolean;
  allowPageExtraction: boolean;
  allowCommenting: boolean;
  allowFormFilling: boolean;
  allowSigning: boolean;
};

/**
 * Build PDF /P permission flags (Revision 3+).
 * Bit set = allowed. Reserved bits 7–8 must be 1; high unused bits typically 1.
 */
export function buildPdfPermissionFlags(
  flags: Omit<PdfSecurityRestrictions, "enabled">,
): number {
  let perms = 0;
  // Bit 3: print, Bit 12: print high-quality
  if (flags.allowPrinting) perms |= 4 | 2048;
  // Bit 4: modify contents
  if (flags.allowChanging) perms |= 8;
  // Bit 5: copy / extract text and graphics
  if (flags.allowContentCopying || flags.allowPageExtraction) perms |= 16;
  // Bit 6: add/modify annotations (commenting + signing UX)
  if (flags.allowCommenting || flags.allowSigning) perms |= 32;
  // Bit 9: fill form fields
  if (flags.allowFormFilling) perms |= 256;
  // Bit 10: extract for accessibility
  if (flags.allowContentCopyingAccessibility) perms |= 512;
  // Bit 11: assemble document
  if (flags.allowDocumentAssembly) perms |= 1024;

  // Reserved bits 7–8 set; keep high bits set (Acrobat-compatible)
  perms |= 0xFFFFF0C0;

  // Signed 32-bit for MuPDF write options
  return perms > 0x7fffffff ? perms - 0x100000000 : perms;
}

function escapeSaveOptionValue(value: string): string {
  // MuPDF option values: avoid commas breaking the options list
  return value.replaceAll(",", "");
}

/**
 * Encrypt PDF with empty user password (open freely) and owner password
 * enforcing Document Restrictions. No-op when restrictions.enabled is false.
 */
export async function encryptPdfWithRestrictions(
  pdfBytes: Uint8Array,
  restrictions: PdfSecurityRestrictions,
): Promise<Uint8Array> {
  if (!restrictions.enabled) {
    return pdfBytes;
  }

  const ownerPassword = env.WATERMARK_PDF_OWNER_PASSWORD?.trim() ?? "";
  if (!ownerPassword) {
    throw httpError.badRequest(
      "WATERMARK_PDF_OWNER_PASSWORD chưa được cấu hình — không thể bật Document Restrictions",
    );
  }

  const permissions = buildPdfPermissionFlags(restrictions);
  const options = [
    "encrypt=aes-256",
    `owner-password=${escapeSaveOptionValue(ownerPassword)}`,
    "user-password=",
    `permissions=${permissions}`,
  ].join(",");

  const doc = new mupdf.PDFDocument(pdfBytes);
  try {
    const buffer = doc.saveToBuffer(options);
    const out = new Uint8Array(buffer.asUint8Array());
    if (out.byteLength === 0) {
      throw new Error("MuPDF encryption produced empty PDF");
    }
    logApi.info(
      { permissions, bytes: out.byteLength },
      "[watermark] Applied PDF document restrictions",
    );
    return out;
  } finally {
    doc.destroy();
  }
}
