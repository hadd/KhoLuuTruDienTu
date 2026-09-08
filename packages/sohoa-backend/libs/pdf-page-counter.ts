import { PDFDocument } from "pdf-lib";

/**
 * Counts the number of pages in a PDF file or byte array.
 * Reads from local filesystem or falls back to S3/MinIO storage if key is provided.
 * Returns 1 if not a valid PDF or upon reading error.
 */
export async function getPdfPageCount(filePathOrBytes: string | Uint8Array): Promise<number> {
    try {
        let bytes: Uint8Array;
        if (typeof filePathOrBytes === "string") {
            if (!filePathOrBytes.toLowerCase().endsWith(".pdf")) {
                return 1;
            }
            try {
                bytes = await Deno.readFile(filePathOrBytes);
            } catch {
                const { downloadBinaryFromStorage } = await import("../modules/data-entry/data-entry-s3-utils.ts");
                bytes = await downloadBinaryFromStorage(filePathOrBytes);
            }
        } else {
            bytes = filePathOrBytes;
        }

        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        return count > 0 ? count : 1;
    } catch {
        return 1;
    }
}
