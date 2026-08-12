export type PhysicalWarehouseSearchModeInput = {
  mode?: string;
};

export function resolvePhysicalWarehouseSearchMode(
  urlQuery: PhysicalWarehouseSearchModeInput,
  q?: string,
): "all" | "metadata" | "content" {
  const explicitMode = urlQuery.mode;
  if (explicitMode === "content") return "content";
  if (explicitMode === "metadata") return "metadata";
  return q?.trim() ? "all" : "metadata";
}
