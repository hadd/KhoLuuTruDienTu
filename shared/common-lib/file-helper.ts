import { normalize, join } from "node:path";
import { tmpdir } from "node:os";
import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";
import { logApp } from "./logger.ts";
import { httpError } from "./http-error.ts";

function isInTmpFolder(path: string): boolean {
  const normalized = normalize(path);
  const parts = normalized.split("/").filter((part) => part.length > 0);

  for (const part of parts) {
    if (part.startsWith("tmp")) {
      return true;
    }
  }

  return false;
}

function isTmpDir(dirPath: string): boolean {
  return isInTmpFolder(dirPath);
}

function generateRandomString(length: number): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

export function createTempFile(ext: string, name?: string): string {
  const tempDir = tmpdir();
  
  let filename: string;
  if (!name || !name.trim()) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const dateStr = `${year}${month}${day}`;
    const timeStr = `${hours}${minutes}`;
    const randomStr = generateRandomString(5);
    const extPart = ext && ext.trim() ? ext : "tmp";
    filename = `${extPart}-${dateStr}-${timeStr}-${randomStr}`;
  } else {
    filename = ext && ext.trim() ? `${name}.${ext}` : name;
  }
  
  return join(tempDir, filename);
}

export async function rmTempFile(filePath: string): Promise<void> {
  if (!isInTmpFolder(filePath)) {
    logApp({ filePath }, `Skipping removal of file: not in a folder starting with "tmp"`);
    return;
  }

  try {
    await Deno.remove(filePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logApp({ filePath, error: errorMessage }, `Failed to remove temporary file`);
    throw error;
  }
}

export async function rmTempDir(dirPath: string): Promise<void> {
  if (!isTmpDir(dirPath)) {
    logApp({ dirPath }, `Skipping removal of directory: not a tmp directory or not in a folder starting with "tmp"`);
    return;
  }

  try {
    await Deno.remove(dirPath, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logApp({ dirPath, error: errorMessage }, `Failed to remove temporary directory`);
    throw error;
  }
}

export const VALID_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
export const VALID_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

export function validateFileType(fileReg: { fileName?: string | null; filePath?: string | null; mimeType?: string | null }): void {
  const ext = extname(fileReg.fileName || fileReg.filePath || '').slice(1).toLowerCase();
  const mimeType = fileReg.mimeType?.toLowerCase();
  
  const isValid = VALID_EXTENSIONS.includes(ext) || (mimeType && VALID_MIME_TYPES.includes(mimeType));
  if (!isValid) {
    throw httpError.badRequest(`Unsupported file type. Only PDF and image files (.pdf, .jpg, .jpeg, .png, .gif, .webp) are supported.`);
  }
}

