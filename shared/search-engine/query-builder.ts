const COMMON_TYPOS: Record<string, string> = {
  "bienlai": "biên lai",
  "hoso": "hồ sơ",
  "tokhai": "tờ khai",
  "quyetdinh": "quyết định",
  "hopdong": "hợp đồng",
  "bienban": "biên bản",
  "baocao": "báo cáo",
  "totrinh": "tờ trình",
  "nghiquyet": "nghị quyết",
  "thongbao": "thông báo",
  "congvan": "công văn",
  "khieunai": "khiếu nại",
  "tocao": "tố cáo",
  "giayphep": "giấy phép",
  "tailieu": "tài liệu",
  "danhmuc": "danh mục",
}

/**
 * Parse quoted phrase: `"Lê Thị Minh Ánh"` → exact phrase mode.
 * Unmatched / partial quotes fall back to smart mode with original text.
 * Also normalizes common compressed typos (e.g. "bienlai" -> "biên lai").
 */
export function parseSearchQuery(raw: string): {
  text: string
  phraseOnly: boolean
} {
  const trimmed = raw.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1).trim()
    if (inner) {
      return { text: inner, phraseOnly: true }
    }
  }

  let normalizedText = trimmed
  const lowerText = trimmed.toLowerCase()
  for (const [typo, fix] of Object.entries(COMMON_TYPOS)) {
    if (lowerText.includes(typo)) {
      normalizedText = normalizedText.replace(new RegExp(`\\b${typo}\\b`, "gi"), fix)
    }
  }

  return { text: normalizedText, phraseOnly: false }
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
    ]
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
      match_phrase_prefix: {
        "fields.value": {
          query: text,
          max_expansions: 50,
          boost: 2,
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
  ]
}
