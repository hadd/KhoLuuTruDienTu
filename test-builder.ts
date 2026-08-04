import { buildUnifiedDossierQuery } from "./shared/search-engine/query-service.ts";
console.log(JSON.stringify(buildUnifiedDossierQuery("269", undefined, [], ["MA_HO_SO"]), null, 2));
