import type { DossierMetadata } from "../metadata-types.ts";

export interface PackagePdfFile {
    fileName: string;
    data: Uint8Array;
    groupCode?: string;
}

export interface PackageBuildInput {
    metadata: DossierMetadata;
    pdfFiles: PackagePdfFile[];
    hoSoId: string;
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
