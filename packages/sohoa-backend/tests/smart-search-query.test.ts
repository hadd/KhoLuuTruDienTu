import { assertEquals } from "@std/assert";
import {
  buildDossierNestedQuery,
  buildUnifiedDossierQuery,
  buildValueShouldClauses,
  parseSearchQuery,
} from "@shared/search-engine";

Deno.test("parseSearchQuery strips matching quotes for phrase-only mode", () => {
  assertEquals(parseSearchQuery('"Lê Thị Minh Ánh"'), {
    text: "Lê Thị Minh Ánh",
    phraseOnly: true,
  });
  assertEquals(parseSearchQuery('  "87/2023/HS-ST"  '), {
    text: "87/2023/HS-ST",
    phraseOnly: true,
  });
});

Deno.test("parseSearchQuery keeps unquoted and empty-inner as smart mode", () => {
  assertEquals(parseSearchQuery("Nguyễn Thị Thu Chung"), {
    text: "Nguyễn Thị Thu Chung",
    phraseOnly: false,
  });
  assertEquals(parseSearchQuery('""'), {
    text: '""',
    phraseOnly: false,
  });
  assertEquals(parseSearchQuery('" partial'), {
    text: '" partial',
    phraseOnly: false,
  });
});

Deno.test("buildValueShouldClauses phrase-only returns single match_phrase", () => {
  const clauses = buildValueShouldClauses("Lê Thị Minh Ánh", true);
  assertEquals(clauses.length, 1);
  assertEquals(
    (clauses[0] as { match_phrase: { "fields.value": { query: string } } })
      .match_phrase["fields.value"].query,
    "Lê Thị Minh Ánh",
  );
});

Deno.test("buildValueShouldClauses smart mode returns phrase + and + fuzzy", () => {
  const clauses = buildValueShouldClauses("Tòa án nhân dân", false);
  assertEquals(clauses.length, 3);

  const phrase = clauses[0] as {
    match_phrase: { "fields.value": { boost: number } };
  };
  const andMatch = clauses[1] as {
    match: { "fields.value": { operator: string; boost: number } };
  };
  const fuzzy = clauses[2] as {
    match: { "fields.value": { fuzziness: string; boost: number } };
  };

  assertEquals(phrase.match_phrase["fields.value"].boost, 5);
  assertEquals(andMatch.match["fields.value"].operator, "and");
  assertEquals(andMatch.match["fields.value"].boost, 3);
  assertEquals(fuzzy.match["fields.value"].fuzziness, "AUTO");
  assertEquals(fuzzy.match["fields.value"].boost, 1);
});

Deno.test("buildDossierNestedQuery quoted uses must phrase + optional groupCode", () => {
  const q = buildDossierNestedQuery('"Nguyễn Thị Thu Chung"', "QUYET_DINH");
  const nested = (q.bool as { must: Array<{ nested: { query: { bool: Record<string, unknown> } } }> })
    .must[0]!.nested.query.bool;

  assertEquals(Array.isArray(nested.must), true);
  assertEquals(Array.isArray(nested.should), false);
  const must = nested.must as Array<Record<string, unknown>>;
  assertEquals(
    (must[0] as { term: { "fields.group_code": string } }).term[
      "fields.group_code"
    ],
    "QUYET_DINH",
  );
});

Deno.test("buildDossierNestedQuery smart uses should + minimum_should_match", () => {
  const q = buildDossierNestedQuery("TAND", "BAN_AN_QUYET_DINH", "Thi hành xong");
  const rootMust = (q.bool as { must: Array<Record<string, unknown>> }).must;
  assertEquals(
    (rootMust[0] as { term: { "trangThaiHoSo.keyword": string } }).term[
      "trangThaiHoSo.keyword"
    ],
    "Thi hành xong",
  );

  const nested = (rootMust[1] as {
    nested: { query: { bool: Record<string, unknown> } };
  }).nested.query.bool;

  assertEquals(nested.minimum_should_match, 1);
  assertEquals((nested.should as unknown[]).length, 3);
  assertEquals(
    (nested.filter as Array<{ term: { "fields.group_code": string } }>)[0]!
      .term["fields.group_code"],
    "BAN_AN_QUYET_DINH",
  );
});

Deno.test("buildUnifiedDossierQuery combines title match and nested OCR with OR", () => {
  const q = buildUnifiedDossierQuery("Hồ sơ thi hành án");
  const bool = q.bool as {
    should: Array<Record<string, unknown>>;
    minimum_should_match: number;
    filter: unknown[];
  };

  assertEquals(bool.minimum_should_match, 1);
  assertEquals(bool.should.length, 2);
  assertEquals("bool" in bool.should[0]!, true);
  assertEquals(
    ((bool.should[1] as { nested: { path: string } }).nested.path),
    "fields",
  );
});

Deno.test("buildUnifiedDossierQuery passes groupCode into nested clause", () => {
  const q = buildUnifiedDossierQuery("quyết định", "QUYET_DINH");
  const nested = (q.bool as {
    should: Array<{ nested: { query: { bool: Record<string, unknown> } } }>;
  }).should[1]!.nested.query.bool;

  assertEquals(
    (nested.filter as Array<{ term: { "fields.group_code": string } }>)[0]!
      .term["fields.group_code"],
    "QUYET_DINH",
  );
});

Deno.test("buildUnifiedDossierQuery attaches shared filter clauses", () => {
  const filters = [{ term: { dossierTypeId: "type-1" } }];
  const q = buildUnifiedDossierQuery("test", undefined, filters);
  const bool = q.bool as { filter: Array<Record<string, unknown>> };

  assertEquals(bool.filter.length, 1);
  assertEquals(
    (bool.filter[0] as { term: { dossierTypeId: string } }).term.dossierTypeId,
    "type-1",
  );
});
