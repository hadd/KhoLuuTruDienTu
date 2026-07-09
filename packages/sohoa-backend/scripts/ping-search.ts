import { configureSearchEngine, ensureAllIndices, pingSearchEngine } from "@shared/search-engine";
import { env } from "../env.ts";

configureSearchEngine({
    enabled: env.ELASTICSEARCH_ENABLED,
    url: env.ELASTICSEARCH_URL,
});

const ok = await pingSearchEngine();
console.log(`Elasticsearch (${env.ELASTICSEARCH_URL}):`, ok ? "OK" : "UNAVAILABLE");

if (ok && env.ELASTICSEARCH_ENABLED) {
    await ensureAllIndices(["dossier", "fond"]);
    console.log("Indices ensured: dossier, fond");
}
