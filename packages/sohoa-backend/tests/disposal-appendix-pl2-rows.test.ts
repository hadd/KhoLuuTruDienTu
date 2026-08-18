import { assertEquals } from "@std/assert";
import {
    buildPl2CatalogRows,
    compareNumericBox,
    extractBoxNumberFromPhysicalItemName,
} from "../modules/archive-disposal/disposal-appendix-pl2-rows.ts";
import { DisposalProposalItemSource } from "../db/schemas/archive-disposal-constants.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";
Deno.test("extractBoxNumberFromPhysicalItemName parses trailing digits", () => {
    assertEquals(extractBoxNumberFromPhysicalItemName("Hộp 1"), "1");
    assertEquals(extractBoxNumberFromPhysicalItemName("Cặp 02"), "2");
    assertEquals(extractBoxNumberFromPhysicalItemName("  Hộp 12  "), "12");
    assertEquals(extractBoxNumberFromPhysicalItemName("Không số"), "");
    assertEquals(extractBoxNumberFromPhysicalItemName(""), "");
});

Deno.test("compareNumericBox sorts empty last and numbers ascending", () => {
    assertEquals(compareNumericBox("1", "2") < 0, true);
    assertEquals(compareNumericBox("10", "2") > 0, true);
    assertEquals(compareNumericBox("", "1") > 0, true);
    assertEquals(compareNumericBox("1", "") < 0, true);
});

Deno.test("buildPl2CatalogRows assigns volume per box group sorted by box", () => {
    const items = [
        {
            id: "i3",
            dossierId: "d3",
            fileId: null,
            source: DisposalProposalItemSource.EXPIRED,
            reason: "",
            notes: "",
            dossierName: "HS-3",
            fileName: null,
            createdAt: new Date("2026-01-03T00:00:00Z"),
        },
        {
            id: "i1",
            dossierId: "d1",
            fileId: null,
            source: DisposalProposalItemSource.EXPIRED,
            reason: "",
            notes: "",
            dossierName: "HS-1",
            fileName: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
            id: "i2",
            dossierId: "d2",
            fileId: null,
            source: DisposalProposalItemSource.DUPLICATE,
            reason: "",
            notes: "",
            dossierName: "HS-2",
            fileName: null,
            createdAt: new Date("2026-01-02T00:00:00Z"),
        },
    ];
    const boxByDossier = new Map([
        ["d1", "1"],
        ["d2", "1"],
        ["d3", "2"],
    ]);
    const rows = buildPl2CatalogRows(items, new Map(), boxByDossier);
    assertEquals(rows.length, 3);
    assertEquals(rows[0]?.seqNumber, "1");
    assertEquals(rows[0]?.boxNumber, "1");
    assertEquals(rows[0]?.volumeNumber, "1");
    assertEquals(rows[0]?.disposalReasonLabel, "Hết thời hạn lưu trữ");
    assertEquals(rows[1]?.boxNumber, "1");
    assertEquals(rows[1]?.volumeNumber, "2");
    assertEquals(rows[2]?.boxNumber, "2");
    assertEquals(rows[2]?.volumeNumber, "1");
});

Deno.test("buildPl2CatalogRows groups unplaced dossiers with empty box at end", () => {
    const items = [
        {
            id: "i1",
            dossierId: "d1",
            fileId: null,
            source: DisposalProposalItemSource.EXPIRED,
            reason: "",
            notes: "",
            dossierName: "Placed",
            fileName: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
            id: "i2",
            dossierId: "d2",
            fileId: null,
            source: DisposalProposalItemSource.EXPIRED,
            reason: "",
            notes: "",
            dossierName: "Unplaced",
            fileName: null,
            createdAt: new Date("2026-01-02T00:00:00Z"),
        },
    ];
    const boxByDossier = new Map([["d1", "5"]]);
    const rows = buildPl2CatalogRows(items, new Map(), boxByDossier);
    assertEquals(rows[0]?.boxNumber, "5");
    assertEquals(rows[1]?.boxNumber, "");
    assertEquals(rows[1]?.volumeNumber, "1");
});

Deno.test("buildPl2CatalogRows uses TIEU_DE_HO_SO from TT05 metadata for title column", () => {
    const items = [{
        id: "i1",
        dossierId: "d1",
        fileId: null,
        source: DisposalProposalItemSource.EXPIRED,
        reason: "",
        notes: "",
        dossierName: "Tên hệ thống",
        fileName: "file.pdf",
        createdAt: new Date("2026-01-01T00:00:00Z"),
    }];
    const metadataByDossier = new Map<string, DossierMetadata>([
        ["d1", {
            metadata_groups: [{
                group_code: "THONG_TIN_HO_SO",
                group_name: "Thông tin hồ sơ",
                source_document: { file_name: null, file_path: null },
                fields: [{
                    name: "TIEU_DE_HO_SO",
                    display: "Tiêu đề hồ sơ",
                    type: "string",
                    value: "Hồ sơ thi hành án chủ động 218/QĐ-CTHADS",
                    page: 1,
                    bbox: null,
                }],
            }],
        }],
    ]);
    const rows = buildPl2CatalogRows(items, metadataByDossier, new Map([["d1", "1"]]));
    assertEquals(rows[0]?.title, "Hồ sơ thi hành án chủ động 218/QĐ-CTHADS");
});
