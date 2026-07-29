import { assertEquals } from "@std/assert";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import {
    HO_SO_FOND_FIELD,
    HO_SO_LUU_TRU_GROUP_CODE,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
} from "../libs/metadata-normalize.ts";
import {
    metadataDocumentMatchesFilePath,
    MUC_DO_TIEP_CAN_FIELD,
    normalizeArchiveFilePathKey,
    patchMetadataForArchiveSubmit,
} from "../modules/archive/archive-metadata-sync.ts";

function sampleMetadata(): DossierMetadata {
    return {
        ho_so_id: "HS-1",
        trang_thai_ho_so: "Đã duyệt",
        metadata_groups: [
            {
                group_code: HO_SO_LUU_TRU_GROUP_CODE,
                group_name: "Hồ sơ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: HO_SO_FOND_FIELD,
                        display: "Phông lưu trữ",
                        type: "string",
                        value: "Phông Cục THA",
                        page: null,
                        bbox: null,
                    },
                    {
                        name: MUC_DO_TIEP_CAN_FIELD,
                        display: "Mức độ tiếp cận",
                        type: "string",
                        value: "Nội bộ",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: TAI_LIEU_LUU_TRU_GROUP_CODE,
                group_name: "Tài liệu 1",
                source_document: {
                    file_name: "doc1.pdf",
                    file_path: "raw/TEST/doc1.pdf",
                },
                fields: [
                    {
                        name: MUC_DO_TIEP_CAN_FIELD,
                        display: "Mức độ tiếp cận",
                        type: "string",
                        value: "Công khai",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: TAI_LIEU_LUU_TRU_GROUP_CODE,
                group_name: "Tài liệu 2",
                source_document: {
                    file_name: "doc2.pdf",
                    file_path: "raw/TEST/doc2.pdf",
                },
                fields: [
                    {
                        name: MUC_DO_TIEP_CAN_FIELD,
                        display: "Mức độ tiếp cận",
                        type: "string",
                        value: "Hạn chế",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };
}

Deno.test("normalizeArchiveFilePathKey uses basename case-insensitively", () => {
    assertEquals(
        normalizeArchiveFilePathKey("raw/TEST/Doc1.PDF"),
        "doc1.pdf",
    );
});

Deno.test("metadataDocumentMatchesFilePath matches basename and suffix path", () => {
    assertEquals(
        metadataDocumentMatchesFilePath("raw/TEST/doc1.pdf", "raw/OTHER/doc1.pdf"),
        true,
    );
    assertEquals(
        metadataDocumentMatchesFilePath("doc1.pdf", "raw/TEST/doc1.pdf"),
        true,
    );
    assertEquals(
        metadataDocumentMatchesFilePath("raw/TEST/doc2.pdf", "raw/TEST/doc1.pdf"),
        false,
    );
});

Deno.test("patchMetadataForArchiveSubmit updates fond and access levels", () => {
    const patched = patchMetadataForArchiveSubmit(sampleMetadata(), {
        fondId: "FOND-001",
        dossierSecurityLevelName: "Tuyệt mật",
        fileSecurityLevels: [
            {
                fileId: "file-1",
                filePath: "raw/TEST/doc1.pdf",
                securityLevelName: "Công khai",
            },
            {
                fileId: "file-2",
                filePath: "raw/TEST/doc2.pdf",
                securityLevelName: "Nội bộ",
            },
        ],
    });

    const hoSo = patched.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
    assertEquals(hoSo?.fields.find((field) => field.name === HO_SO_FOND_FIELD)?.value, "FOND-001");
    assertEquals(
        hoSo?.fields.find((field) => field.name === MUC_DO_TIEP_CAN_FIELD)?.value,
        "Tuyệt mật",
    );

    const doc1 = patched.metadata_groups.find(
        (group) => group.source_document?.file_path === "raw/TEST/doc1.pdf",
    );
    const doc2 = patched.metadata_groups.find(
        (group) => group.source_document?.file_path === "raw/TEST/doc2.pdf",
    );
    assertEquals(
        doc1?.fields.find((field) => field.name === MUC_DO_TIEP_CAN_FIELD)?.value,
        "Công khai",
    );
    assertEquals(
        doc2?.fields.find((field) => field.name === MUC_DO_TIEP_CAN_FIELD)?.value,
        "Nội bộ",
    );
});

Deno.test("patchMetadataForArchiveSubmit creates missing fond field", () => {
    const metadata = sampleMetadata();
    const hoSo = metadata.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
    if (hoSo) {
        hoSo.fields = hoSo.fields.filter((field) => field.name !== HO_SO_FOND_FIELD);
    }

    const patched = patchMetadataForArchiveSubmit(metadata, {
        fondId: "FOND-NEW",
        dossierSecurityLevelName: null,
        fileSecurityLevels: [],
    });

    const patchedHoSo = patched.metadata_groups.find(
        (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    );
    assertEquals(
        patchedHoSo?.fields.some((field) => field.name === HO_SO_FOND_FIELD && field.value === "FOND-NEW"),
        true,
    );
});
