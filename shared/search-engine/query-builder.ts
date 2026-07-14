/**
 * Parse quoted phrase: `"Lê Thị Minh Ánh"` → exact phrase mode.
 * Unmatched / partial quotes fall back to smart mode with original text.
 */
export function parseSearchQuery(raw: string): {
  text: string;
  phraseOnly: boolean;
} {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner) {
      return { text: inner, phraseOnly: true };
    }
  }
  return { text: trimmed, phraseOnly: false };
}

/** Build value-matching clauses for nested fields.value (boost: phrase > AND > fuzzy). */
export function buildValueShouldClauses(
  text: string,
  phraseOnly: boolean,
): Record<string, unknown>[] {
  if (phraseOnly) {
    return [
      {
        match_phrase: {
          "fields.value": {
            query: text,
            slop: 1,
          },
        },
      },
    ];
  }

  return [
    {
      match_phrase: {
        "fields.value": {
          query: text,
          slop: 1,
          boost: 5,
        },
      },
    },
    {
      match: {
        "fields.value": {
          query: text,
          operator: "and",
          boost: 3,
        },
      },
    },
    {
      match: {
        "fields.value": {
          query: text,
          fuzziness: "AUTO",
          prefix_length: 1,
          /** synonym_graph không tương thích fuzziness — dùng analyzer index. */
          analyzer: "vi_analyzer",
          boost: 1,
        },
      },
    },
  ];
}
