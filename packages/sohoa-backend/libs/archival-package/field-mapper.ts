import type { DossierMetadata, MetadataField, MetadataGroup } from "../metadata-types.ts";
import { expandTaiLieuDocuments, resolveMetadataFieldBbox } from "../metadata-normalize.ts";
import type { HosoXmlFields } from "./package-types.ts";

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function xmlElement(tag: string, value: string | null | undefined, indent: string): string {
    if (value == null || value === "") {
        return "";
    }
    return `${indent}<${tag}>${escapeXml(value)}</${tag}>`;
}

function findFieldValue(metadata: DossierMetadata, ...names: string[]): string | null {
    const normalized = names.map((n) => n.toUpperCase());
    for (const group of metadata.metadata_groups) {
        for (const field of group.fields) {
            const fieldName = field.name.toUpperCase();
            if (normalized.some((n) => fieldName.includes(n) || n.includes(fieldName))) {
                if (field.value != null && String(field.value).trim() !== "") {
                    return String(field.value).trim();
                }
            }
        }
    }
    return null;
}

function collectGroupNames(metadata: DossierMetadata): string {
    const names = metadata.metadata_groups
        .map((g) => g.group_name?.trim())
        .filter((n): n is string => !!n);
    return [...new Set(names)].join("; ");
}

export function mapMetadataToHosoFields(
    metadata: DossierMetadata,
    hoSoId: string,
): HosoXmlFields {
    const tieuDe = findFieldValue(metadata, "TIEU_DE", "TEN_HO_SO", "TRICH_YEU")
        ?? collectGroupNames(metadata)
        ?? hoSoId;

    return {
        maHoSo: hoSoId,
        tieuDe,
        thoiHanLuuTru: findFieldValue(metadata, "THOI_HAN_LUU_TRU", "THOI_HAN"),
        tongSoTaiLieu: metadata.metadata_groups.length,
        ghiChu: findFieldValue(metadata, "GHI_CHU", "NOTE"),
        ngonNgu: findFieldValue(metadata, "NGON_NGU", "LANGUAGE") ?? "vi",
        loaiTaiLieu: collectGroupNames(metadata) || null,
    };
}

function formatFieldValue(field: MetadataField): string | null {
    if (field.value == null) {
        return null;
    }
    const text = String(field.value).trim();
    return text === "" ? null : text;
}

function buildFieldXml(field: MetadataField, indent: string): string {
    const bbox = resolveMetadataFieldBbox(field);
    const lines = [
        `${indent}<Truong>`,
        xmlElement("MaTruong", field.name, `${indent}  `),
        xmlElement("TenHienThi", field.display, `${indent}  `),
        xmlElement("KieuDuLieu", field.type, `${indent}  `),
        xmlElement("GiaTri", formatFieldValue(field), `${indent}  `),
        field.page != null ? `${indent}  <Trang>${field.page}</Trang>` : "",
        bbox != null && bbox.length > 0
            ? `${indent}  <Bbox>${escapeXml(JSON.stringify(bbox))}</Bbox>`
            : "",
        `${indent}</Truong>`,
    ];
    return lines.filter(Boolean).join("\n");
}

function buildGroupXml(group: MetadataGroup, indent: string): string {
    const source = group.source_document;
    const fieldBlocks = group.fields.map((field) => buildFieldXml(field, `${indent}    `));

    const lines = [
        `${indent}<NhomTaiLieu>`,
        xmlElement("MaNhom", group.group_code, `${indent}  `),
        xmlElement("TenNhom", group.group_name, `${indent}  `),
        `${indent}  <TaiLieuGoc>`,
        xmlElement("TenFile", source?.file_name ?? null, `${indent}    `),
        xmlElement("DuongDan", source?.file_path ?? null, `${indent}    `),
        `${indent}  </TaiLieuGoc>`,
        `${indent}  <TruongDuLieu>`,
        ...fieldBlocks,
        `${indent}  </TruongDuLieu>`,
        `${indent}</NhomTaiLieu>`,
    ];
    return lines.filter(Boolean).join("\n");
}

/** XML đầy đủ: dữ liệu chủ hồ sơ + toàn bộ nhóm/tài liệu/trường metadata. */
export function buildHosoXmlFromMetadata(
    metadata: DossierMetadata,
    hoSoId: string,
    packageType: "AIP_hoso" | "DIP_hoso",
): string {
    const fields = mapMetadataToHosoFields(metadata, hoSoId);
    const groupBlocks = expandTaiLieuDocuments(metadata).metadata_groups.map((group) =>
        buildGroupXml(group, "  ")
    );

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<HoSo package="${packageType}" xmlns="http://luutru.vn/tt05/2025">`,
        xmlElement("MaHoSo", fields.maHoSo, "  "),
        xmlElement("TieuDe", fields.tieuDe, "  "),
        xmlElement("ThoiHanLuuTru", fields.thoiHanLuuTru, "  "),
        xmlElement("NgonNgu", fields.ngonNgu ?? "vi", "  "),
        `  <TongSoTaiLieu>${fields.tongSoTaiLieu}</TongSoTaiLieu>`,
        xmlElement("LoaiTaiLieu", fields.loaiTaiLieu, "  "),
        xmlElement("GhiChu", fields.ghiChu, "  "),
        xmlElement("TrangThaiHoSo", metadata.trang_thai_ho_so ?? null, "  "),
        metadata.ho_so_id ? xmlElement("HoSoId", metadata.ho_so_id, "  ") : "",
        "  <DanhSachNhomTaiLieu>",
        ...groupBlocks,
        "  </DanhSachNhomTaiLieu>",
        "</HoSo>",
    ];
    return lines.filter(Boolean).join("\n");
}

/** @deprecated Dùng buildHosoXmlFromMetadata — giữ cho test tương thích header-only. */
export function buildHosoXml(fields: HosoXmlFields, packageType: "AIP_hoso" | "DIP_hoso"): string {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<HoSo package="${packageType}" xmlns="http://luutru.vn/tt05/2025">`,
        `  <MaHoSo>${escapeXml(fields.maHoSo)}</MaHoSo>`,
        `  <TieuDe>${escapeXml(fields.tieuDe ?? "")}</TieuDe>`,
        fields.thoiHanLuuTru
            ? `  <ThoiHanLuuTru>${escapeXml(fields.thoiHanLuuTru)}</ThoiHanLuuTru>`
            : "",
        `  <NgonNgu>${escapeXml(fields.ngonNgu ?? "vi")}</NgonNgu>`,
        `  <TongSoTaiLieu>${fields.tongSoTaiLieu}</TongSoTaiLieu>`,
        fields.loaiTaiLieu
            ? `  <LoaiTaiLieu>${escapeXml(fields.loaiTaiLieu)}</LoaiTaiLieu>`
            : "",
        fields.ghiChu
            ? `  <GhiChu>${escapeXml(fields.ghiChu)}</GhiChu>`
            : "",
        "</HoSo>",
    ];
    return lines.filter(Boolean).join("\n");
}
