import { Client } from "@elastic/elasticsearch";
import { getSearchEngineConfig } from "./config.ts";

let client: Client | null = null;

export function isSearchEngineEnabled(): boolean {
  return getSearchEngineConfig().enabled;
}

export function getEsClient(): Client | null {
  if (!isSearchEngineEnabled()) {
    return null;
  }

  if (!client) {
    const { url } = getSearchEngineConfig();
    client = new Client({ node: url });
  }

  return client;
}

export async function pingSearchEngine(): Promise<boolean> {
  const es = getEsClient();
  if (!es) return false;
  try {
    await es.ping();
    return true;
  } catch {
    return false;
  }
}
