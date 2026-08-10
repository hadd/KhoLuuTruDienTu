import { assertEquals } from "@std/assert";
import {
    dedupePhysicalWarehouseSearchItems,
    physicalWarehouseSearchDedupeKey,
} from "../modules/physical-warehouse/physical-warehouse-search-dedupe.ts";

Deno.test("dedupe merges duplicate ES hits at same box with different entityId", () => {
    const boxId = "11111111-1111-1111-1111-111111111111";
    const items = [
        {
            entityId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            title: "269_CD",
            fondId: "fond-a",
            score: 1,
            physicalPlacement: {
                physicalItemId: boxId,
                locationRootId: null,
                breadcrumb: "Hà Nội > Hộp 1",
                ancestorIds: [boxId],
            },
        },
        {
            entityId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            title: "269_CD",
            fondId: "fond-a",
            score: 2,
            physicalPlacement: {
                physicalItemId: boxId,
                locationRootId: null,
                breadcrumb: "Hà Nội > Hộp 1",
                ancestorIds: [boxId],
            },
        },
    ];
    const out = dedupePhysicalWarehouseSearchItems(items);
    assertEquals(out.length, 1);
    assertEquals(out[0]!.entityId, items[1]!.entityId);
});

Deno.test("dedupe keeps same title at different boxes", () => {
    const box1 = "11111111-1111-1111-1111-111111111111";
    const box2 = "22222222-2222-2222-2222-222222222222";
    const items = [
        {
            entityId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            title: "269_CD",
            fondId: "fond-a",
            physicalPlacement: {
                physicalItemId: box1,
                locationRootId: null,
                breadcrumb: "Hộp 1",
                ancestorIds: [box1],
            },
        },
        {
            entityId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            title: "269_CD",
            fondId: "fond-b",
            physicalPlacement: {
                physicalItemId: box2,
                locationRootId: null,
                breadcrumb: "Hộp 1-1",
                ancestorIds: [box2],
            },
        },
    ];
    assertEquals(
        physicalWarehouseSearchDedupeKey(items[0]!),
        physicalWarehouseSearchDedupeKey(items[0]!),
    );
    assertEquals(physicalWarehouseSearchDedupeKey(items[0]!), `placed:${box1}:269_cd:fond-a`);
    assertEquals(physicalWarehouseSearchDedupeKey(items[1]!), `placed:${box2}:269_cd:fond-b`);
    assertEquals(dedupePhysicalWarehouseSearchItems(items).length, 2);
});

Deno.test("dedupe keeps unplaced dossiers separate by entityId", () => {
    const items = [
        { entityId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "269_CD", fondId: "fond-a" },
        { entityId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "269_CD", fondId: "fond-a" },
    ];
    assertEquals(dedupePhysicalWarehouseSearchItems(items).length, 2);
});
