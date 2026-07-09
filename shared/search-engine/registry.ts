import type { IndexAdapter } from "./types.ts";

const adapters = new Map<string, IndexAdapter>();

export function registerAdapter(adapter: IndexAdapter): void {
  adapters.set(adapter.entityType, adapter);
}

export function getAdapter(entityType: string): IndexAdapter | undefined {
  return adapters.get(entityType);
}

export function getRegisteredEntityTypes(): string[] {
  return [...adapters.keys()];
}
