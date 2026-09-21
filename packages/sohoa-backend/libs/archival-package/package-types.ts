import type { DossierMetadata } from "../metadata-types.ts";

export interface PackagePdfFile {
    fileName: string;
    data: Uint8Array;
    groupCode?: string;
    preserveSignature?: boolean;
}

export interface PackageBuildInput {
    metadata: DossierMetadata;
    pdfFiles: PackagePdfFile[];
    hoSoId: string;
    /** Nested ZIP folder path preserving warehouse hierarchy; falls back to hoSoId. */
    zipFolderPath?: string;
    /** Relative path from the clicked folder to the dossier folder. */
    folderPath?: string;
    /** Clicked folder name (baseFolderName), used as the ZIP sub-folder for folder exports. */
    folderName?: string;
}

export interface PackageBuildResult {
    buffer: Uint8Array;
    filename: string;
    manifestLines: string[];
}

export interface HosoXmlFields {
    maHoSo: string;
    tieuDe: string | null;
    thoiHanLuuTru: string | null;
    tongSoTaiLieu: number;
    ghiChu: string | null;
    ngonNgu: string | null;
    loaiTaiLieu: string | null;
}
