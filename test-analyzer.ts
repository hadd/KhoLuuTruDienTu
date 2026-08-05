import { getEsClient } from "./shared/search-engine/client.ts";
import { configureSearchEngine } from "./shared/search-engine/config.ts";
import { load } from "https://deno.land/std@0.220.1/dotenv/mod.ts";
async function main() {
  const env = await load({ export: true, envPath: "./packages/sohoa-backend/.env" });
  configureSearchEngine({
    enabled: true,
    url: env["ELASTICSEARCH_URL"] || "http://localhost:2005"
  });
  const es = getEsClient();
  const res = await es?.indices.analyze({
    index: "sohoa_dossier",
    analyzer: "vi_analyzer",
    text: "269_CD"
  });
  console.log(res?.tokens);
}
main().catch(console.error);
