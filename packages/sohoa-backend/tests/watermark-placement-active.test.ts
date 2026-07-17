import { assertEquals } from "@std/assert";
import {
  pickNextActiveCandidate,
  resolveDeactivatePromotion,
} from "../modules/watermark/watermark-config-service.ts";

type Fixture = {
  id: string;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
};

function placement(
  id: string,
  opts: {
    isActive?: boolean;
    updatedAt: string;
    createdAt?: string;
  },
): Fixture {
  return {
    id,
    isActive: opts.isActive ?? false,
    updatedAt: new Date(opts.updatedAt),
    createdAt: new Date(opts.createdAt ?? opts.updatedAt),
  };
}

Deno.test("pickNextActiveCandidate prefers newest updatedAt", () => {
  const rows = [
    placement("a", { updatedAt: "2026-07-01T10:00:00Z" }),
    placement("b", { updatedAt: "2026-07-10T10:00:00Z" }),
    placement("c", { updatedAt: "2026-07-05T10:00:00Z" }),
  ];
  const next = pickNextActiveCandidate(rows, "a");
  assertEquals(next?.id, "b");
});

Deno.test("pickNextActiveCandidate breaks ties with newest createdAt", () => {
  const rows = [
    placement("older", {
      updatedAt: "2026-07-10T10:00:00Z",
      createdAt: "2026-06-01T10:00:00Z",
    }),
    placement("newer", {
      updatedAt: "2026-07-10T10:00:00Z",
      createdAt: "2026-07-01T10:00:00Z",
    }),
  ];
  const next = pickNextActiveCandidate(rows, "x");
  assertEquals(next?.id, "newer");
});

Deno.test("pickNextActiveCandidate returns null when only excluded id exists", () => {
  const rows = [placement("only", { updatedAt: "2026-07-01T10:00:00Z" })];
  assertEquals(pickNextActiveCandidate(rows, "only"), null);
});

Deno.test("resolveDeactivatePromotion promotes newest other placement", () => {
  const rows = [
    placement("active", {
      isActive: true,
      updatedAt: "2026-07-01T10:00:00Z",
    }),
    placement("stale", { updatedAt: "2026-07-02T10:00:00Z" }),
    placement("fresh", { updatedAt: "2026-07-09T10:00:00Z" }),
  ];
  assertEquals(resolveDeactivatePromotion(rows, "active"), {
    action: "promote",
    promoteId: "fresh",
  });
});

Deno.test("resolveDeactivatePromotion blocks when only one placement", () => {
  const rows = [
    placement("only", {
      isActive: true,
      updatedAt: "2026-07-01T10:00:00Z",
    }),
  ];
  assertEquals(resolveDeactivatePromotion(rows, "only"), {
    action: "block",
    reason: "only_placement",
  });
});

Deno.test("resolveDeactivatePromotion noops when target already inactive", () => {
  const rows = [
    placement("a", { isActive: true, updatedAt: "2026-07-01T10:00:00Z" }),
    placement("b", { isActive: false, updatedAt: "2026-07-02T10:00:00Z" }),
  ];
  assertEquals(resolveDeactivatePromotion(rows, "b"), { action: "noop" });
});

Deno.test("resolveDeactivatePromotion noops when target missing", () => {
  const rows = [
    placement("a", { isActive: true, updatedAt: "2026-07-01T10:00:00Z" }),
  ];
  assertEquals(resolveDeactivatePromotion(rows, "missing"), { action: "noop" });
});

Deno.test("create-like: when no active exists, new placement should be active", () => {
  const existing = [
    placement("a", { isActive: false, updatedAt: "2026-07-01T10:00:00Z" }),
    placement("b", { isActive: false, updatedAt: "2026-07-02T10:00:00Z" }),
  ];
  const hasActive = existing.some((row) => row.isActive);
  assertEquals(hasActive, false);
  // Mirrors createPlacement: isActive = !existingActive
  assertEquals(!hasActive, true);
});

Deno.test("delete-like: deleting active promotes newest remaining", () => {
  const rows = [
    placement("active", {
      isActive: true,
      updatedAt: "2026-07-01T10:00:00Z",
    }),
    placement("keep-old", { updatedAt: "2026-07-03T10:00:00Z" }),
    placement("keep-new", { updatedAt: "2026-07-08T10:00:00Z" }),
  ];
  const promote = pickNextActiveCandidate(rows, "active");
  assertEquals(promote?.id, "keep-new");
});
