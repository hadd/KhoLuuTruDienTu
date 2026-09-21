import { assertEquals } from "@std/assert";
import {
  createAsyncMutex,
  EXPORT_METADATA_DOSSIER_CONCURRENCY,
  mapWithConcurrency,
} from "../libs/export-concurrency.ts";

Deno.test("EXPORT_METADATA_DOSSIER_CONCURRENCY defaults to 20", () => {
  assertEquals(EXPORT_METADATA_DOSSIER_CONCURRENCY, 20);
});

Deno.test("createAsyncMutex serializes exclusive work", async () => {
  const mutex = createAsyncMutex();
  const order: number[] = [];

  await Promise.all([
    mutex.runExclusive(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 30));
      order.push(2);
    }),
    mutex.runExclusive(async () => {
      order.push(3);
      await new Promise((r) => setTimeout(r, 5));
      order.push(4);
    }),
  ]);

  assertEquals(order, [1, 2, 3, 4]);
});

Deno.test("mapWithConcurrency runs up to N workers", async () => {
  let peak = 0;
  let inflight = 0;
  const items = Array.from({ length: 8 }, (_, i) => i);

  await mapWithConcurrency(items, 3, async (item) => {
    inflight += 1;
    peak = Math.max(peak, inflight);
    await new Promise((r) => setTimeout(r, 15));
    inflight -= 1;
    return item;
  });

  assertEquals(peak <= 3, true);
  assertEquals(peak >= 2, true);
});
