import { assertEquals } from "@std/assert";
import { clientIpFromRequest, pickProcessIndex } from "../libs/cluster-route.ts";

Deno.test("pickProcessIndex stays on one process for the same IP", () => {
  const first = pickProcessIndex("10.10.4.21", 3);
  assertEquals(pickProcessIndex("10.10.4.21", 3), first);
  assertEquals(first >= 0 && first < 3, true);
});

Deno.test("pickProcessIndex is zero when only one process", () => {
  assertEquals(pickProcessIndex("203.0.113.8", 1), 0);
});

Deno.test("clientIpFromRequest uses the first forwarded address", () => {
  assertEquals(
    clientIpFromRequest("203.0.113.8, 10.0.0.1", "127.0.0.1"),
    "203.0.113.8",
  );
  assertEquals(clientIpFromRequest(null, "192.168.1.9"), "192.168.1.9");
});
