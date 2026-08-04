import { buildValueShouldClauses } from "./shared/search-engine/query-builder.ts";
console.log(JSON.stringify(buildValueShouldClauses("test", false), null, 2));
