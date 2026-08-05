import { searchUnifiedDocuments } from "./shared/search-engine/query-service.ts";
import { configureSearchEngine } from "./shared/search-engine/config.ts";
import { load } from "https://deno.land/std@0.220.1/dotenv/mod.ts";

async function main() {
  const env = await load({ export: true, envPath: "./packages/sohoa-backend/.env" });
  configureSearchEngine({
    enabled: env["ELASTICSEARCH_ENABLED"] === "true",
    url: env["ELASTICSEARCH_URL"] || "http://localhost:2005"
  });
  
  // Wait a bit for configureSearchEngine to finish async mappings
  await new Promise(r => setTimeout(r, 1000));
  
  const res = await getEsClient().indices.analyze({ index: "sohoa_dossier", analyzer: "vi_analyzer", text: "269_CD" }); console.log(res.tokens); }
    q: "269",
    searchFields: ["MA_HO_SO"],
    from: 0,
    size: 10
  });
  console.log("Matched:", res.total);
  if (res.hits.length > 0) {
    console.log("First hit:", res.hits[0].hoSoId);
  }
}
main().catch(console.error);
